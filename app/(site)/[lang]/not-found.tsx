import Link from "next/link";
export default function NotFound() {
  return (
    <section className="page on"><div className="wrap hero">
      <h1>404</h1>
      <p className="text muted"><span lang="ar">الصفحة غير موجودة.</span> · <span lang="en">This page doesn&apos;t exist.</span></p>
      <p><Link className="arrowlink" href="/">سهيل</Link> · <Link className="arrowlink" href="/en">Suhail</Link></p>
    </div></section>
  );
}
