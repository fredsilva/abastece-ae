import { StationsPage } from "./StationsPage";

export function App() {
  return (
    <div className="app-shell">
      <div className="top-nav">
        <h1 style={{ fontSize: 20 }}>Abastece Aê — Admin</h1>
        <div className="nav-pill-group">
          <button className="category-tab category-tab-active">Postos</button>
        </div>
      </div>
      <StationsPage />
    </div>
  );
}
