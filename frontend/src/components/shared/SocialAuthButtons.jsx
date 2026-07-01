import { Github } from "lucide-react";

import { authProviderUrl } from "../../api/axiosInstance";
import { Button } from "../ui/Button";

function GoogleMark() {
  return <span className="google-mark">G</span>;
}

export function SocialAuthButtons({ next = "/dashboard", showGithub = true }) {
  function start(provider) {
    window.location.href = authProviderUrl(provider, next);
  }

  return (
    <div className="social-auth">
      <Button variant="secondary" onClick={() => start("google")}>
        <GoogleMark /> Continue with Google
      </Button>
      {showGithub && (
        <Button variant="secondary" onClick={() => start("github")}>
          <Github size={18} /> Continue with GitHub
        </Button>
      )}
    </div>
  );
}
