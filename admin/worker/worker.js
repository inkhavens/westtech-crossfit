/* Cloudflare Worker: GitHub sign-in helper for the West Tech CrossFit Site Builder (/admin).
   It finishes GitHub's sign-in on a server so the client secret never touches the website.

   Variables (Cloudflare → this Worker → Settings → Variables and Secrets):
     GITHUB_CLIENT_ID      Text    – the Client ID of your GitHub OAuth App
     GITHUB_CLIENT_SECRET  Secret  – the Client secret of your GitHub OAuth App
     ALLOWED_RETURN        Text    – https://inkhavens.github.io/westtech-crossfit/admin/
*/
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const allowed = (ret) => {
      try {
        const r = new URL(ret);
        return (env.ALLOWED_RETURN || "").split(",").map((s) => s.trim()).filter(Boolean).some((a) => r.href.startsWith(a));
      } catch (e) { return false; }
    };

    if (url.pathname === "/login") {
      const ret = url.searchParams.get("return") || "";
      if (!allowed(ret)) return text("That return address isn't allowed. Check ALLOWED_RETURN in the Worker settings.", 400);
      if (!env.GITHUB_CLIENT_ID) return text("GITHUB_CLIENT_ID isn't set in the Worker settings.", 500);
      const state = crypto.randomUUID();
      const gh = new URL("https://github.com/login/oauth/authorize");
      gh.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
      gh.searchParams.set("redirect_uri", url.origin + "/callback");
      gh.searchParams.set("scope", "public_repo");
      gh.searchParams.set("state", state);
      gh.searchParams.set("allow_signup", "false");
      return new Response(null, { status: 302, headers: { Location: gh.toString(), "Set-Cookie": cookie("wt_oauth", state + "|" + encodeURIComponent(ret), 600), "Cache-Control": "no-store" } });
    }

    if (url.pathname === "/callback") {
      const raw = (request.headers.get("Cookie") || "").split(/;\s*/).find((c) => c.startsWith("wt_oauth="));
      const [state, retEnc] = raw ? raw.slice("wt_oauth=".length).split("|") : [];
      const ret = retEnc ? decodeURIComponent(retEnc) : "";
      if (!state || state !== url.searchParams.get("state") || !allowed(ret)) {
        return text("This sign-in link expired or didn't match. Go back to the Site Builder and click Sign in again.", 400);
      }
      const back = (hash) => new Response(null, { status: 302, headers: { Location: ret + "#" + hash, "Set-Cookie": cookie("wt_oauth", "", 0), "Cache-Control": "no-store" } });
      if (url.searchParams.get("error")) return back("error=" + encodeURIComponent(url.searchParams.get("error_description") || url.searchParams.get("error")));
      const r = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json", "User-Agent": "westtech-admin-auth" },
        body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code: url.searchParams.get("code"), redirect_uri: url.origin + "/callback" }),
      });
      const data = await r.json().catch(() => ({}));
      if (!data.access_token) return back("error=" + encodeURIComponent(data.error_description || data.error || "GitHub didn't send back a sign-in token."));
      return back("token=" + encodeURIComponent(data.access_token));
    }

    return text("West Tech CrossFit sign-in helper is running.", 200);
  },
};

function cookie(name, value, maxAge) { return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`; }
function text(body, status) { return new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } }); }
