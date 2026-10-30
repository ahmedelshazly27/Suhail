// Shown the moment someone taps a link, inside the dashboard frame, while the next page loads on the server.
export default function Loading() {
  return (
    <div className="skel-page" role="status" aria-live="polite">
      <span className="vh-sr">Loading · جارٍ التحميل</span>
      <div className="skel skel-eb" />
      <div className="skel skel-h" />
      <div className="skel-cards">
        {[0, 1, 2].map((i) => <div key={i} className="skel skel-card" />)}
      </div>
    </div>
  );
}
