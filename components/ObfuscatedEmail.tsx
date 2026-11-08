// 問い合わせ先のメールアドレス（ソース上で文字列をそのまま書かず、単純な収集を避ける）
export function ObfuscatedEmail() {
  const user = "hiro979mrta";
  const domain = "gmail";
  const tld = "com";

  const email = `${user}@${domain}.${tld}`;

  return <a href={`mailto:${email}`} className="underline">{email}</a>;
}
