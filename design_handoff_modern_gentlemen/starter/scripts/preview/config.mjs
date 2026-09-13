/** Preview-only configuration. Production continues to use next start. */
export function previewConfig(env) {
  function required(name) {
    const value = env[name] || "";
    if (!value || /(?:your[-_ ]|example|\.\.\.|<.+>|•|…)/i.test(value)) {
      throw new Error(name + " must be configured with a real value");
    }
    return value;
  }
  function origin(name) {
    const value = required(name);
    let url;
    try {
      url = new URL(value);
    } catch {
      throw new Error(name + " must be an HTTPS origin");
    }
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      throw new Error(name + " must be an HTTPS origin");
    }
    return url;
  }
  if (env.MG_PREVIEW !== "1") throw new Error("MG_PREVIEW must be 1");
  const ref = required("MG_PREVIEW_SUPABASE_REF");
  if (!/^[a-z]{20}$/.test(ref)) throw new Error("Invalid preview project reference");
  const database = origin("NEXT_PUBLIC_SUPABASE_URL");
  const source = origin("MG_PREVIEW_SOURCE_SUPABASE_URL");
  if (database.hostname !== ref + ".supabase.co" || database.port) {
    throw new Error("Database URL does not match the independently configured preview project");
  }
  if (database.origin === source.origin) {
    throw new Error("Preview must use a different database from the source site");
  }
  const site = origin("NEXT_PUBLIC_SITE_URL");
  const username = required("MG_PREVIEW_USERNAME");
  const password = required("MG_PREVIEW_PASSWORD");
  if (!/^[a-zA-Z0-9._-]{1,64}$/.test(username)) {
    throw new Error("Preview username must use letters, digits, dots, underscores or hyphens");
  }
  if (password.length < 32 || password.length > 256 || !/^[\x21-\x7e]+$/.test(password)) {
    throw new Error("Preview password must contain 32–256 printable non-space ASCII characters");
  }
  if (required("NEXT_PUBLIC_SUPABASE_ANON_KEY").length < 24) {
    throw new Error("Preview publishable key is implausibly short");
  }
  const port = Number(env.PORT || 8080);
  if (!Number.isInteger(port) || port < 1 || port > 65534) {
    throw new Error("PORT must be between 1 and 65534");
  }
  return { site, database, source, ref, username, password, port, upstreamPort: port + 1 };
}
