export default function NotApprovedPage() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "80vh",
        textAlign: "center",
        gap: "20px",
      }}
    >
      <h1>Access Restricted</h1>
      <p>Your account is not approved for beta access yet.</p>

      <a
        href="/"
        style={{
          padding: "10px 20px",
          border: "1px solid #00ff99",
          borderRadius: "8px",
          textDecoration: "none",
          color: "#00ff99",
          fontWeight: "bold",
        }}
      >
        Click here to return to home
      </a>
    </div>
  );
}
