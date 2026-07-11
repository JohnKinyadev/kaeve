import base64
import json
from datetime import datetime
from decimal import Decimal
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .models import LedgerEntry, Loan, LoanRepayment, MpesaTransaction
from .services import get_loan_outstanding_amount, money


MPESA_TIMEOUT_SECONDS = 30


def mpesa_base_url():
    return "https://api.safaricom.co.ke" if settings.MPESA_ENV == "production" else "https://sandbox.safaricom.co.ke"


def normalize_mpesa_phone(phone_number):
    phone = "".join(char for char in str(phone_number or "") if char.isdigit())
    if phone.startswith("0") and len(phone) == 10:
        phone = f"254{phone[1:]}"
    elif phone.startswith("7") and len(phone) == 9:
        phone = f"254{phone}"
    elif phone.startswith("1") and len(phone) == 9:
        phone = f"254{phone}"

    if not phone.startswith("254") or len(phone) not in {12, 13}:
        raise ValueError("Enter a valid Safaricom phone number, for example 0712345678.")
    return phone


def ensure_mpesa_configured():
    missing = [
        name
        for name in [
            "MPESA_CONSUMER_KEY",
            "MPESA_CONSUMER_SECRET",
            "MPESA_SHORTCODE",
            "MPESA_PASSKEY",
            "MPESA_CALLBACK_BASE_URL",
        ]
        if not getattr(settings, name, "")
    ]
    if missing:
        raise ValueError(f"M-Pesa is not configured. Missing: {', '.join(missing)}.")


def mpesa_access_token():
    ensure_mpesa_configured()
    credentials = f"{settings.MPESA_CONSUMER_KEY}:{settings.MPESA_CONSUMER_SECRET}".encode("utf-8")
    encoded_credentials = base64.b64encode(credentials).decode("utf-8")
    request = Request(
        f"{mpesa_base_url()}/oauth/v1/generate?grant_type=client_credentials",
        headers={"Authorization": f"Basic {encoded_credentials}"},
    )
    with urlopen(request, timeout=MPESA_TIMEOUT_SECONDS) as response:
        payload = json.loads(response.read().decode("utf-8"))
    return payload["access_token"]


def post_mpesa_json(path, payload):
    token = mpesa_access_token()
    request = Request(
        f"{mpesa_base_url()}{path}",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=MPESA_TIMEOUT_SECONDS) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        detail = exc.read().decode("utf-8")
        raise ValueError(detail or "M-Pesa rejected the payment request.") from exc
    except URLError as exc:
        raise ValueError("Unable to reach M-Pesa. Please try again.") from exc


def stk_amount(amount):
    value = Decimal(amount or 0)
    if value <= 0:
        raise ValueError("Repayment amount must be greater than zero.")
    if value != value.quantize(Decimal("1")):
        raise ValueError("M-Pesa repayment amount must be a whole Kenyan shilling amount.")
    return int(value)


def initiate_loan_repayment(loan, member, phone_number, amount, initiated_by):
    ensure_mpesa_configured()
    if loan.member_id != member.id:
        raise ValueError("You can only repay your own loan.")
    if loan.status != Loan.Status.APPROVED:
        raise ValueError("Only approved loans can be repaid through M-Pesa.")

    amount_value = money(amount)
    outstanding = get_loan_outstanding_amount(loan)
    if amount_value > outstanding:
        raise ValueError(f"Repayment exceeds outstanding balance of Ksh {outstanding}.")

    phone = normalize_mpesa_phone(phone_number)
    mpesa_amount = stk_amount(amount_value)
    timestamp = timezone.localtime().strftime("%Y%m%d%H%M%S")
    password = base64.b64encode(
        f"{settings.MPESA_SHORTCODE}{settings.MPESA_PASSKEY}{timestamp}".encode("utf-8")
    ).decode("utf-8")
    account_reference = f"LOAN{loan.id}"
    description = f"Loan repayment {account_reference}"
    callback_url = f"{settings.MPESA_CALLBACK_BASE_URL.rstrip('/')}/api/payments/mpesa/stk-callback/"

    transaction_record = MpesaTransaction.objects.create(
        member=member,
        loan=loan,
        initiated_by=initiated_by,
        phone_number=phone,
        amount=amount_value,
        account_reference=account_reference,
        description=description,
    )
    payload = {
        "BusinessShortCode": settings.MPESA_SHORTCODE,
        "Password": password,
        "Timestamp": timestamp,
        "TransactionType": settings.MPESA_STK_TRANSACTION_TYPE,
        "Amount": mpesa_amount,
        "PartyA": phone,
        "PartyB": settings.MPESA_SHORTCODE,
        "PhoneNumber": phone,
        "CallBackURL": callback_url,
        "AccountReference": account_reference,
        "TransactionDesc": description,
    }

    try:
        response = post_mpesa_json("/mpesa/stkpush/v1/processrequest", payload)
    except ValueError:
        transaction_record.status = MpesaTransaction.Status.FAILED
        transaction_record.raw_request = {**payload, "Password": "***"}
        transaction_record.save(update_fields=["status", "raw_request", "updated_at"])
        raise

    transaction_record.merchant_request_id = response.get("MerchantRequestID", "")
    transaction_record.checkout_request_id = response.get("CheckoutRequestID") or None
    transaction_record.result_description = response.get("ResponseDescription", "")
    transaction_record.raw_request = {**payload, "Password": "***"}
    transaction_record.raw_response = response
    transaction_record.save(
        update_fields=[
            "merchant_request_id",
            "checkout_request_id",
            "result_description",
            "raw_request",
            "raw_response",
            "updated_at",
        ]
    )
    return transaction_record


def callback_metadata_value(metadata_items, name):
    for item in metadata_items:
        if item.get("Name") == name:
            return item.get("Value")
    return None


def parse_mpesa_paid_at(value):
    if not value:
        return timezone.now()
    try:
        parsed = datetime.strptime(str(value), "%Y%m%d%H%M%S")
        return timezone.make_aware(parsed, timezone.get_current_timezone())
    except ValueError:
        return timezone.now()


@transaction.atomic
def record_stk_callback(payload):
    callback = payload.get("Body", {}).get("stkCallback", {})
    checkout_request_id = callback.get("CheckoutRequestID")
    if not checkout_request_id:
        return None

    transaction_record = (
        MpesaTransaction.objects.select_for_update()
        .select_related("loan", "member")
        .filter(checkout_request_id=checkout_request_id)
        .first()
    )
    if transaction_record is None:
        return None

    result_code = str(callback.get("ResultCode", ""))
    result_description = callback.get("ResultDesc", "")
    transaction_record.result_code = result_code
    transaction_record.result_description = result_description
    transaction_record.raw_callback = payload

    if result_code != "0":
        transaction_record.status = MpesaTransaction.Status.FAILED
        transaction_record.save(
            update_fields=["result_code", "result_description", "raw_callback", "status", "updated_at"]
        )
        return transaction_record

    metadata_items = callback.get("CallbackMetadata", {}).get("Item", [])
    receipt = callback_metadata_value(metadata_items, "MpesaReceiptNumber") or ""
    amount = money(callback_metadata_value(metadata_items, "Amount") or transaction_record.amount)
    paid_at = parse_mpesa_paid_at(callback_metadata_value(metadata_items, "TransactionDate"))

    transaction_record.status = MpesaTransaction.Status.SUCCESS
    transaction_record.mpesa_receipt_number = receipt
    transaction_record.amount = amount
    transaction_record.paid_at = paid_at
    transaction_record.save(
        update_fields=[
            "result_code",
            "result_description",
            "raw_callback",
            "status",
            "mpesa_receipt_number",
            "amount",
            "paid_at",
            "updated_at",
        ]
    )

    repayment, _ = LoanRepayment.objects.get_or_create(
        transaction=transaction_record,
        defaults={
            "member": transaction_record.member,
            "loan": transaction_record.loan,
            "amount": amount,
            "method": LoanRepayment.Method.MPESA,
            "reference": receipt or transaction_record.checkout_request_id or "",
            "paid_at": paid_at,
        },
    )
    LedgerEntry.objects.get_or_create(
        member=transaction_record.member,
        season=transaction_record.loan.season,
        entry_type=LedgerEntry.EntryType.DEDUCTION,
        reference=f"loan-repayment:{repayment.id}",
        defaults={
            "description": f"M-Pesa loan repayment {receipt or transaction_record.account_reference}",
            "amount": amount,
        },
    )
    return transaction_record
