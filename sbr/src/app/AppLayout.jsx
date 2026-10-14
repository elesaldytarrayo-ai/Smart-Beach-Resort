// AppLayout — simple wrapper component for page content
// Renders children inside a main container with a shared layout class
export default function AppLayout({ children }) {
  return (
    <main className="app-main-wrapper">
      {children}
    </main>
  );
}