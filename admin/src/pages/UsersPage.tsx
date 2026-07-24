import { useEffect, useState } from "react";
import { listUsers, banUser, unbanUser } from "../api";
import type { User } from "../types";

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setError(null);
    try {
      const data = await listUsers();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar usuários");
    } finally {
      setLoading(false);
    }
  }

  async function handleBan(id: string) {
    try {
      await banUser(id);
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, status: "banned" } : u)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao banir usuário");
    }
  }

  async function handleUnban(id: string) {
    try {
      await unbanUser(id);
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, status: "active" } : u)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao desbanir usuário");
    }
  }

  if (loading) return <div>Carregando...</div>;

  return (
    <div style={{ padding: "20px" }}>
      <h1>Usuários</h1>
      {error && <div style={{ color: "red", marginBottom: "16px" }}>{error}</div>}

      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Trust Score</th>
              <th>Status</th>
              <th>Data de Criação</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.email}</td>
                <td>{user.trustScore}</td>
                <td>{user.status === "active" ? "Ativo" : "Banido"}</td>
                <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                <td>
                  {user.status === "active" ? (
                    <button onClick={() => handleBan(user.id)} style={{ color: "red" }}>
                      Banir
                    </button>
                  ) : (
                    <button onClick={() => handleUnban(user.id)} style={{ color: "green" }}>
                      Desbanir
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {users.length === 0 && <p>Nenhum usuário encontrado.</p>}
    </div>
  );
}
