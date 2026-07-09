import { useEffect, useMemo, useState } from "react";
import { Banknote, Download, Megaphone, Package, Scale, WalletCards } from "lucide-react";

import { announcementsAPI } from "../../api/announcementsAPI";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";
import { StatCard } from "../../components/ui/StatCard";
import { Table } from "../../components/ui/Table";
import { authAPI } from "../../api/authAPI";
import { apiClient } from "../../api/axiosInstance";
import { fertilizerAPI } from "../../api/fertilizerAPI";
import { loansAPI } from "../../api/loansAPI";
import { useAuth } from "../../hooks/useAuth";
import { formatCurrency, formatDate, formatKg } from "../../utils/formatters";

function listResults(response) {
  if (Array.isArray(response)) return response;
  return response?.results || [];
}

export function MemberPortalPage({ initialTab = "overview" }) {
  const { user, logout, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [deliveries, setDeliveries] = useState([]);
  const [loans, setLoans] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [fertilizerInventory, setFertilizerInventory] = useState([]);
  const [fertilizerRequests, setFertilizerRequests] = useState([]);
  const [error, setError] = useState("");
  const [profileForm, setProfileForm] = useState({
    full_name: "",
    national_id: "",
    phone_number: "",
    farm_size_acres: "",
    location: "",
  });
  const [loanForm, setLoanForm] = useState({
    loan_type: "cherry_advance",
    proof_type: "delivery_history",
    collateral_type: "future_harvest",
    guarantor: "",
    amount: "",
    savings_amount: "",
    term_months: "6",
    reason: "",
    guarantor_details: "",
    collateral_details: "",
  });
  const [loanPolicy, setLoanPolicy] = useState(null);
  const [eligibility, setEligibility] = useState(null);
  const [guarantorQuery, setGuarantorQuery] = useState("");
  const [guarantorResults, setGuarantorResults] = useState([]);
  const [guarantorNotice, setGuarantorNotice] = useState("");
  const [selectedGuarantorLabel, setSelectedGuarantorLabel] = useState("");
  const [fertilizerForm, setFertilizerForm] = useState({ requested_kg: "", reason: "" });
  const [loanMessage, setLoanMessage] = useState("");
  const [loanError, setLoanError] = useState("");
  const [fertilizerMessage, setFertilizerMessage] = useState("");
  const [fertilizerError, setFertilizerError] = useState("");
  const [profileError, setProfileError] = useState("");
  const [isCompletingProfile, setIsCompletingProfile] = useState(false);
  const [isApplyingLoan, setIsApplyingLoan] = useState(false);
  const [isRequestingFertilizer, setIsRequestingFertilizer] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const member = user?.member;

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  async function handleProfileSubmit(event) {
    event.preventDefault();
    setProfileError("");
    setIsCompletingProfile(true);

    try {
      await authAPI.completeMemberProfile(profileForm);
      await refreshUser();
      setActiveTab("overview");
    } catch (err) {
      setProfileError(err.message || "Unable to complete member profile");
    } finally {
      setIsCompletingProfile(false);
    }
  }

  async function handleLoanSubmit(event) {
    event.preventDefault();
    setLoanError("");
    setLoanMessage("");
    setIsApplyingLoan(true);

    try {
      await loansAPI.apply(loanForm);
      setLoanForm((value) => ({ ...value, amount: "", reason: "", guarantor: "", guarantor_details: "", collateral_details: "" }));
      setGuarantorQuery("");
      setGuarantorResults([]);
      setSelectedGuarantorLabel("");
      setLoanMessage("Loan application submitted for admin or manager approval.");
      setReloadKey((value) => value + 1);
    } catch (err) {
      setLoanError(err.message || "Unable to submit loan application");
    } finally {
      setIsApplyingLoan(false);
    }
  }

  async function handleFertilizerSubmit(event) {
    event.preventDefault();
    setFertilizerError("");
    setFertilizerMessage("");
    setIsRequestingFertilizer(true);

    try {
      const activeInventory = fertilizerInventory.find((item) => item.is_active) || fertilizerInventory[0];
      await fertilizerAPI.createRequest({
        inventory: activeInventory?.id,
        requested_kg: fertilizerForm.requested_kg,
        reason: fertilizerForm.reason,
      });
      setFertilizerForm({ requested_kg: "", reason: "" });
      setFertilizerMessage("Fertilizer request submitted for admin or manager approval.");
      setReloadKey((value) => value + 1);
    } catch (err) {
      setFertilizerError(err.message || "Unable to submit fertilizer request");
    } finally {
      setIsRequestingFertilizer(false);
    }
  }

  useEffect(() => {
    let isMounted = true;
    loansAPI.currentPolicy()
      .then((policy) => {
        if (isMounted) setLoanPolicy(policy);
      })
      .catch(() => {
        if (isMounted) setLoanPolicy(null);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!member) return undefined;
    let isMounted = true;
    loansAPI.eligibility({
      loan_type: loanForm.loan_type,
      proof_type: loanForm.proof_type,
      collateral_type: loanForm.collateral_type,
      savings_amount: loanForm.savings_amount,
    })
      .then((data) => {
        if (isMounted) setEligibility(data);
      })
      .catch(() => {
        if (isMounted) setEligibility(null);
      });
    return () => {
      isMounted = false;
    };
  }, [loanForm.collateral_type, loanForm.loan_type, loanForm.proof_type, loanForm.savings_amount, member, reloadKey]);

  useEffect(() => {
    if (loanForm.collateral_type !== "guarantor" || guarantorQuery.trim().length < 2) {
      setGuarantorResults([]);
      setGuarantorNotice("");
      return undefined;
    }
    if (loanForm.guarantor && guarantorQuery === selectedGuarantorLabel) {
      setGuarantorResults([]);
      setGuarantorNotice("");
      return undefined;
    }

    let isMounted = true;
    const timer = window.setTimeout(() => {
      loansAPI.searchGuarantors(guarantorQuery)
        .then((data) => {
          if (!isMounted) return;
          const results = data.results || [];
          setGuarantorResults(results);
          setGuarantorNotice(results.length ? "" : "No existing member matches that name or membership number.");
        })
        .catch(() => {
          if (isMounted) {
            setGuarantorResults([]);
            setGuarantorNotice("Unable to search guarantors.");
          }
        });
    }, 250);

    return () => {
      isMounted = false;
      window.clearTimeout(timer);
    };
  }, [guarantorQuery, loanForm.collateral_type, loanForm.guarantor, selectedGuarantorLabel]);

  useEffect(() => {
    let isMounted = true;

    async function loadPortalData() {
      if (!member) return;

      try {
        const [
          deliveryResponse,
          loanResponse,
          payoutResponse,
          announcementResponse,
          fertilizerInventoryResponse,
          fertilizerRequestResponse,
        ] = await Promise.all([
          apiClient.get("/api/deliveries/"),
          apiClient.get("/api/loans/"),
          apiClient.get("/api/payouts/"),
          announcementsAPI.list(),
          fertilizerAPI.inventory({ is_active: true }),
          fertilizerAPI.requests(),
        ]);

        if (!isMounted) return;
        setDeliveries(listResults(deliveryResponse));
        setLoans(listResults(loanResponse));
        setPayouts(listResults(payoutResponse));
        setAnnouncements(listResults(announcementResponse));
        setFertilizerInventory(listResults(fertilizerInventoryResponse));
        setFertilizerRequests(listResults(fertilizerRequestResponse));
      } catch (err) {
        if (isMounted) setError(err.message || "Unable to load member records");
      }
    }

    loadPortalData();
    return () => {
      isMounted = false;
    };
  }, [member, reloadKey]);

  const totalKg = useMemo(
    () => deliveries.reduce((sum, delivery) => sum + Number(delivery.weight_kg || 0), 0),
    [deliveries],
  );
  const lastDelivery = deliveries[0]?.delivery_date || deliveries[0]?.created_at;
  const activeLoan = loans[0];
  const latestPayout = payouts[0];
  const needsProfile = !member;
  const usesFutureHarvest = loanForm.collateral_type === "future_harvest";
  const eligibleAmount = Number(eligibility?.eligible_amount || 0);
  const applicationsClosed = loanPolicy && !loanPolicy.applications_open;
  const activeFertilizerInventory = fertilizerInventory.find((item) => item.is_active) || fertilizerInventory[0];
  const fertilizerCapKg = Number(activeFertilizerInventory?.member_cap_kg || 0);
  const fertilizerStockKg = Number(activeFertilizerInventory?.quantity_kg || 0);

  return (
    <main className="portal-screen role-member">
      <section className="portal-header">
        <div>
          <span className="eyebrow">Member Portal</span>
          <h1>Welcome, {member?.full_name || user?.name}</h1>
        </div>
        <Button variant="secondary" onClick={logout}>Logout</Button>
      </section>

      <section className="tabs member-tabs" aria-label="Member dashboard sections">
        <button className={activeTab === "overview" ? "active" : ""} type="button" onClick={() => setActiveTab("overview")}>
          Overview
        </button>
        <button className={activeTab === "complete" ? "active" : ""} type="button" onClick={() => setActiveTab("complete")}>
          Complete Registration
        </button>
        <button className={activeTab === "loan" ? "active" : ""} type="button" onClick={() => setActiveTab("loan")}>
          Apply for Loan
        </button>
        <button className={activeTab === "fertilizer" ? "active" : ""} type="button" onClick={() => setActiveTab("fertilizer")}>
          Fertilizer
        </button>
        <button className={activeTab === "announcements" ? "active" : ""} type="button" onClick={() => setActiveTab("announcements")}>
          Announcements
        </button>
      </section>

      {needsProfile && activeTab === "overview" && (
        <article className="panel empty-state">
          <h2>Complete your profile details</h2>
          <p>Your account is ready. Add your cooperative member details to unlock deliveries, loans, and payouts.</p>
        </article>
      )}

      {activeTab === "complete" && !member && (
        <article className="panel form-panel member-completion-panel">
          <div className="panel-header">
            <div>
              <h2>Finish member registration</h2>
              <span>Add your cooperative profile details to unlock your member dashboard.</span>
            </div>
          </div>
          <form className="form-grid" onSubmit={handleProfileSubmit}>
            <Input
              label="Full name"
              value={profileForm.full_name}
              onChange={(event) => setProfileForm((value) => ({ ...value, full_name: event.target.value }))}
              required
            />
            <Input
              label="National ID"
              value={profileForm.national_id}
              onChange={(event) => setProfileForm((value) => ({ ...value, national_id: event.target.value }))}
              required
            />
            <Input
              label="Phone number"
              value={profileForm.phone_number}
              onChange={(event) => setProfileForm((value) => ({ ...value, phone_number: event.target.value }))}
            />
            <Input
              label="Farm size acres"
              type="number"
              step="0.01"
              value={profileForm.farm_size_acres}
              onChange={(event) => setProfileForm((value) => ({ ...value, farm_size_acres: event.target.value }))}
              required
            />
            <Input
              label="Location"
              value={profileForm.location}
              onChange={(event) => setProfileForm((value) => ({ ...value, location: event.target.value }))}
              required
            />
            {profileError && <div className="form-error">{profileError}</div>}
            <div className="form-actions">
              <Button type="submit" disabled={isCompletingProfile}>
                {isCompletingProfile ? "Saving profile..." : "Complete registration"}
              </Button>
            </div>
          </form>
        </article>
      )}

      {activeTab === "complete" && member && (
        <article className="panel empty-state">
          <h2>Registration complete</h2>
          <p>Your profile is linked to membership number {member.membership_number}.</p>
        </article>
      )}

      {activeTab === "loan" && (
        <article className="panel form-panel member-loan-panel">
          <div className="panel-header">
            <div>
              <h2>Apply for a loan</h2>
              <span>Applications are reviewed by an admin or manager before approval.</span>
            </div>
          </div>
          {!member ? (
            <div className="empty-state">
              <h2>Complete registration first</h2>
              <p>Your member profile is required before you can submit a loan application.</p>
            </div>
          ) : (
            <form className="form-grid" onSubmit={handleLoanSubmit}>
              {loanPolicy && (
                <div className="loan-policy-summary field-wide">
                  <span>Advance rate: {formatCurrency(Number(loanPolicy.advance_rate_per_kg || 0))}/kg</span>
                  <span>Interest: {loanPolicy.interest_rate_percent}%</span>
                  <span>Harvest cap: {loanPolicy.future_harvest_cap_percent}%</span>
                  <span>Eligible limit: {formatCurrency(eligibleAmount)}</span>
                </div>
              )}
              {applicationsClosed && <div className="form-error field-wide">Loan applications are currently closed.</div>}
              <label className="field">
                <span>Loan type</span>
                <select
                  value={loanForm.loan_type}
                  onChange={(event) => setLoanForm((value) => ({ ...value, loan_type: event.target.value }))}
                >
                  <option value="cherry_advance">Cherry advance</option>
                  <option value="input_advance">Farm input advance</option>
                  <option value="development">Development loan</option>
                  <option value="school_fees">School fees loan</option>
                  <option value="emergency">Emergency loan</option>
                </select>
              </label>
              <label className="field">
                <span>Collateral category</span>
                <select
                  value={loanForm.collateral_type}
                  onChange={(event) => {
                    setLoanForm((value) => ({ ...value, collateral_type: event.target.value, guarantor: "" }));
                    setGuarantorQuery("");
                    setGuarantorResults([]);
                    setGuarantorNotice("");
                    setSelectedGuarantorLabel("");
                  }}
                >
                  <option value="future_harvest">Future harvest / crop lien</option>
                  <option value="guarantor">Member guarantor</option>
                </select>
              </label>
              <Input
                label="Amount requested"
                type="number"
                min="1"
                step="0.01"
                value={loanForm.amount}
                onChange={(event) => setLoanForm((value) => ({ ...value, amount: event.target.value }))}
                required
              />
              {usesFutureHarvest ? (
                <div className="loan-policy-note field-wide">
                  <strong>Future harvest collateral</strong>
                  <span>
                    Last 12 months deliveries: {formatKg(Number(eligibility?.last_12_month_delivery_kg || 0))}.
                    Your limit is based on this harvest record, the admin-set advance rate, and the configured cap.
                  </span>
                </div>
              ) : (
                <>
                  <Input
                    label="Savings or shares amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={loanForm.savings_amount}
                    onChange={(event) => setLoanForm((value) => ({ ...value, savings_amount: event.target.value, proof_type: "savings" }))}
                    required
                  />
                  <label className="field">
                    <span>Search guarantor</span>
                    <input
                      value={guarantorQuery}
                      onChange={(event) => {
                        setGuarantorQuery(event.target.value);
                        setLoanForm((value) => ({ ...value, guarantor: "", guarantor_details: "" }));
                        setSelectedGuarantorLabel("");
                      }}
                      placeholder="Type member name or number"
                    />
                  </label>
                  {guarantorResults.length > 0 && (
                    <div className="guarantor-results field-wide">
                      {guarantorResults.map((guarantor) => (
                        <button
                          className={loanForm.guarantor === String(guarantor.id) ? "active" : ""}
                          key={guarantor.id}
                          type="button"
                          onClick={() => {
                            const label = `${guarantor.membership_number} - ${guarantor.full_name}`;
                            setLoanForm((value) => ({ ...value, guarantor: String(guarantor.id), guarantor_details: label }));
                            setGuarantorQuery(label);
                            setSelectedGuarantorLabel(label);
                            setGuarantorResults([]);
                            setGuarantorNotice("");
                          }}
                        >
                          {guarantor.membership_number} - {guarantor.full_name}
                        </button>
                      ))}
                    </div>
                  )}
                  {guarantorNotice && <div className="form-error field-wide">{guarantorNotice}</div>}
                </>
              )}
              <Input
                label="Term months"
                type="number"
                min="1"
                max="36"
                step="1"
                value={loanForm.term_months}
                onChange={(event) => setLoanForm((value) => ({ ...value, term_months: event.target.value }))}
                required
              />
              <Input
                label="Reason"
                value={loanForm.reason}
                onChange={(event) => setLoanForm((value) => ({ ...value, reason: event.target.value }))}
                required
              />
              {usesFutureHarvest && (
                <label className="field field-wide">
                  <span>Crop lien notes</span>
                  <textarea
                    value={loanForm.collateral_details}
                    onChange={(event) => setLoanForm((value) => ({ ...value, collateral_details: event.target.value }))}
                    placeholder="Optional notes about expected delivery period or crop lien"
                  />
                </label>
              )}
              {loanError && <div className="form-error">{loanError}</div>}
              {loanMessage && <div className="form-success">{loanMessage}</div>}
              <div className="form-actions">
                <Button type="submit" disabled={isApplyingLoan || applicationsClosed || (usesFutureHarvest && eligibleAmount <= 0)}>
                  {isApplyingLoan ? "Submitting..." : "Submit application"}
                </Button>
              </div>
            </form>
          )}
        </article>
      )}

      {activeTab === "fertilizer" && (
        <div className="page-stack">
          <article className="panel form-panel">
            <div className="panel-header">
              <div>
                <h2>Request fertilizer</h2>
                <span>Factory stock and member caps are set by admin or manager.</span>
              </div>
              <Package size={22} />
            </div>
            {!member ? (
              <div className="empty-state">
                <h2>Complete registration first</h2>
                <p>Your member profile is required before you can request fertilizer.</p>
              </div>
            ) : !activeFertilizerInventory ? (
              <div className="empty-state">
                <h2>No fertilizer available</h2>
                <p>The factory has not opened fertilizer applications yet.</p>
              </div>
            ) : (
              <form className="form-grid" onSubmit={handleFertilizerSubmit}>
                <div className="loan-policy-summary field-wide">
                  <span>Type: {activeFertilizerInventory.fertilizer_type}</span>
                  <span>Available: {formatKg(fertilizerStockKg)}</span>
                  <span>Member cap: {formatKg(fertilizerCapKg)}</span>
                </div>
                <Input
                  label="Kg requested"
                  type="number"
                  min="0.01"
                  max={fertilizerCapKg || undefined}
                  step="0.01"
                  value={fertilizerForm.requested_kg}
                  onChange={(event) => setFertilizerForm((value) => ({ ...value, requested_kg: event.target.value }))}
                  required
                />
                <Input
                  label="Reason"
                  value={fertilizerForm.reason}
                  onChange={(event) => setFertilizerForm((value) => ({ ...value, reason: event.target.value }))}
                />
                {fertilizerError && <div className="form-error field-wide">{fertilizerError}</div>}
                {fertilizerMessage && <div className="form-success field-wide">{fertilizerMessage}</div>}
                <div className="form-actions">
                  <Button type="submit" disabled={isRequestingFertilizer || fertilizerStockKg <= 0 || fertilizerCapKg <= 0}>
                    {isRequestingFertilizer ? "Submitting..." : "Submit request"}
                  </Button>
                </div>
              </form>
            )}
          </article>

          <article className="panel">
            <div className="panel-header">
              <div>
                <h2>My fertilizer requests</h2>
                <span>Approved requests reduce factory stock when reviewed.</span>
              </div>
            </div>
            <Table
              columns={[
                { key: "created_at", label: "Date", render: (row) => formatDate(row.created_at) },
                { key: "fertilizer_type", label: "Type" },
                { key: "requested_kg", label: "Requested", render: (row) => formatKg(Number(row.requested_kg || 0)) },
                { key: "status", label: "Status", render: (row) => <Badge tone={row.status === "approved" ? "success" : row.status === "rejected" ? "danger" : "warning"}>{row.status_display || row.status}</Badge> },
              ]}
              rows={fertilizerRequests}
            />
          </article>
        </div>
      )}

      {activeTab === "announcements" && (
        <article className="panel">
          <div className="panel-header">
            <div>
              <h2>Announcements</h2>
              <span>Factory updates and member notices.</span>
            </div>
            <Megaphone size={22} />
          </div>
          <div className="announcement-list">
            {announcements.length === 0 && (
              <div className="empty-state">
                <h2>No announcements yet</h2>
                <p>Updates from the cooperative will appear here.</p>
              </div>
            )}
            {announcements.map((announcement) => (
              <article className="announcement-item" key={announcement.id}>
                <div>
                  <h3>{announcement.title}</h3>
                  <span>{formatDate(announcement.published_at)}</span>
                </div>
                <p>{announcement.body}</p>
              </article>
            ))}
          </div>
        </article>
      )}

      {error && <div className="form-error">{error}</div>}

      {activeTab === "overview" && (
        <div className="member-overview-stack">
          <section className="stat-grid">
            <StatCard
              icon={Scale}
              label="Season Deliveries"
              value={formatKg(totalKg)}
              detail={needsProfile ? "Complete registration to unlock records" : lastDelivery ? `Last delivery: ${formatDate(lastDelivery)}` : "No deliveries recorded"}
            />
            <StatCard
              icon={Banknote}
              label="Loan Status"
              value={needsProfile ? "Pending profile" : activeLoan?.status_display || activeLoan?.status || "No active loan"}
              detail={needsProfile ? "Loan records appear after verification" : activeLoan ? formatCurrency(Number(activeLoan.amount || 0)) : "No deductions pending"}
            />
            <StatCard
              icon={WalletCards}
              label="Latest Payout"
              value={needsProfile ? formatCurrency(0) : latestPayout ? formatCurrency(Number(latestPayout.net_payable || 0)) : formatCurrency(0)}
              detail={needsProfile ? "Payouts appear after profile completion" : latestPayout?.season_name || "No payout generated"}
            />
          </section>
          <article className="panel">
            <div className="panel-header">
              <div>
                <h2>Recent Deliveries</h2>
                <span>{member?.membership_number || "Complete registration to link records"}</span>
              </div>
              <Button disabled={!latestPayout}><Download size={16} /> Download</Button>
            </div>
            <Table
              columns={[
                { key: "delivery_date", label: "Date", render: (row) => formatDate(row.delivery_date) },
                { key: "collection_point_name", label: "Collection Point" },
                { key: "weight_kg", label: "Weight", render: (row) => formatKg(Number(row.weight_kg || 0)) },
                { key: "grade_display", label: "Grade" },
              ]}
              rows={deliveries.slice(0, 5)}
            />
          </article>
        </div>
      )}
    </main>
  );
}
