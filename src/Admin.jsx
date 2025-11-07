import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { MdDelete, MdEdit, MdSave, MdClose, MdBarChart } from "react-icons/md";
import { BiArrowBack } from "react-icons/bi";
import AIAssistant from "./AIAssistant";
import { hashPassword, RateLimiter, RATE_LIMITS, constantTimeCompare } from "./security";

export default function Admin({ onBack }) {
  const [votes, setVotes] = useState([]);
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editValue, setEditValue] = useState(0);
  const [stats, setStats] = useState({ total: 0, totalVotes: 0 });

  // Hash SHA-256 da senha admin
  // Em produção, use autenticação real no backend!
const ADMIN_PASSWORD_HASH = "74866eb8a08ad1d39059a4c368536f3a09ea4511def2113a8aef46534b91e0a3"; // Hash SHA-256 de "tIFi240206?"
  
  // Rate limiter para login
  const loginRateLimiter = new RateLimiter(
    RATE_LIMITS.ADMIN_LOGIN.MAX_ATTEMPTS,
    RATE_LIMITS.ADMIN_LOGIN.TIME_WINDOW,
    RATE_LIMITS.ADMIN_LOGIN.LOCKOUT_TIME
  );

  useEffect(() => {
    if (!isAuthenticated) return;

    const q = query(collection(db, "votes"), orderBy("value", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const votesData = [];
      let totalVotes = 0;
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        votesData.push({
          id: doc.id,
          ...data,
        });
        totalVotes += data.value || 0;
      });

      setVotes(votesData);
      setStats({
        total: votesData.length,
        totalVotes: totalVotes,
      });
    });

    return () => unsubscribe();
  }, [isAuthenticated]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    
    if (!password) {
      setLoginError("Digite a senha");
      return;
    }

    // Verifica rate limit
    const rateLimitCheck = loginRateLimiter.attempt('admin_login');
    if (!rateLimitCheck.allowed) {
      setLoginError(rateLimitCheck.error);
      setPassword("");
      return;
    }

    try {
      // Hash da senha inserida
      const inputHash = await hashPassword(password);
      
      // Comparação de tempo constante para prevenir timing attacks
      if (constantTimeCompare(inputHash, ADMIN_PASSWORD_HASH)) {
        setIsAuthenticated(true);
        setPassword("");
        setLoginError("");
        loginRateLimiter.reset('admin_login'); // Reseta após login bem-sucedido
      } else {
        const remaining = rateLimitCheck.remaining - 1;
        setLoginError(`Senha incorreta! ${remaining > 0 ? `${remaining} tentativa(s) restante(s).` : ''}`);
        setPassword("");
      }
    } catch (error) {
      console.error("Erro no login:", error);
      setLoginError("Erro ao processar login");
      setPassword("");
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Tem certeza que deseja deletar "${name}"?`)) return;
    
    try {
      await deleteDoc(doc(db, "votes", id));
      console.log("Voto deletado:", name);
    } catch (err) {
      console.error("Erro ao deletar:", err);
      alert("Erro ao deletar: " + err.message);
    }
  };

  const startEdit = (vote) => {
    setEditingId(vote.id);
    setEditName(vote.name);
    setEditValue(vote.value);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditValue(0);
  };

  const saveEdit = async () => {
    if (!editName.trim()) {
      alert("Nome não pode estar vazio!");
      return;
    }

    try {
      await updateDoc(doc(db, "votes", editingId), {
        name: editName.trim(),
        value: Number(editValue),
      });
      cancelEdit();
    } catch (err) {
      console.error("Erro ao atualizar:", err);
      alert("Erro ao atualizar: " + err.message);
    }
  };

  const clearAllVotes = async () => {
    if (!window.confirm("⚠️ ATENÇÃO! Isso vai deletar TODOS os votos. Tem certeza?")) return;
    if (!window.confirm("Última confirmação: Deletar tudo mesmo?")) return;

    try {
      const deletePromises = votes.map(vote => deleteDoc(doc(db, "votes", vote.id)));
      await Promise.all(deletePromises);
      alert("Todos os votos foram deletados!");
    } catch (err) {
      console.error("Erro ao limpar votos:", err);
      alert("Erro ao limpar votos: " + err.message);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-neutral-900 text-white flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="bg-neutral-800 rounded-2xl p-8 shadow-2xl border border-neutral-700">
            <h1 className="text-3xl font-bold mb-2 text-center">Admin Dashboard</h1>
            <p className="text-neutral-400 text-center mb-8">Controle de Votações</p>
            
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-neutral-300">Senha de Acesso</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-neutral-700 border border-neutral-600 rounded-lg px-4 py-3 text-white placeholder-neutral-400 focus:border-blue-500 focus:outline-none"
                  placeholder="Digite a senha..."
                  autoFocus
                />
              </div>
              {loginError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  {loginError}
                </div>
              )}
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition-colors"
              >
                Entrar
              </button>
            </form>

            <button
              onClick={onBack}
              className="w-full mt-4 text-neutral-400 hover:text-white transition-colors flex items-center justify-center gap-2"
            >
              <BiArrowBack /> Voltar para votação
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
            >
              <BiArrowBack className="text-2xl" />
            </button>
            <div>
              <h1 className="text-3xl font-bold">Dashboard Admin</h1>
              <p className="text-neutral-400">Gerenciamento de Votações</p>
            </div>
          </div>
          <button
            onClick={() => setIsAuthenticated(false)}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors"
          >
            Sair
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-neutral-800 rounded-xl p-6 border border-neutral-700">
            <div className="flex items-center gap-3 mb-2">
              <MdBarChart className="text-3xl text-blue-400" />
              <h3 className="text-lg font-medium text-neutral-400">Total de Participantes</h3>
            </div>
            <p className="text-4xl font-bold">{stats.total}</p>
          </div>

          <div className="bg-neutral-800 rounded-xl p-6 border border-neutral-700">
            <div className="flex items-center gap-3 mb-2">
              <MdBarChart className="text-3xl text-green-400" />
              <h3 className="text-lg font-medium text-neutral-400">Total de Votos</h3>
            </div>
            <p className="text-4xl font-bold">{stats.totalVotes}</p>
          </div>

          <div className="bg-neutral-800 rounded-xl p-6 border border-neutral-700">
            <div className="flex items-center gap-3 mb-2">
              <MdBarChart className="text-3xl text-purple-400" />
              <h3 className="text-lg font-medium text-neutral-400">Média de Votos</h3>
            </div>
            <p className="text-4xl font-bold">
              {stats.total > 0 ? (stats.totalVotes / stats.total).toFixed(1) : 0}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="mb-6 flex gap-3">
          <button
            onClick={clearAllVotes}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <MdDelete /> Limpar Todos os Votos
          </button>
        </div>

        {/* AI Assistant */}
        <div className="mb-8">
          <AIAssistant votes={votes} />
        </div>

        {/* Votes Table */}
        <div className="bg-neutral-800 rounded-xl border border-neutral-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-900/50 border-b border-neutral-700">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-neutral-300">Posição</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-neutral-300">Nome</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-neutral-300">Votos</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-neutral-300">Porcentagem</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-neutral-300">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-700">
                {votes.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-neutral-500">
                      Nenhum voto registrado ainda
                    </td>
                  </tr>
                ) : (
                  votes.map((vote, index) => (
                    <tr key={vote.id} className="hover:bg-neutral-700/50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-neutral-700 font-bold text-sm">
                          {index + 1}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {editingId === vote.id ? (
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="bg-neutral-700 border border-neutral-600 rounded px-3 py-1 focus:border-blue-500 focus:outline-none"
                          />
                        ) : (
                          <span className="font-medium text-lg">{vote.name}</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {editingId === vote.id ? (
                          <input
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="bg-neutral-700 border border-neutral-600 rounded px-3 py-1 w-24 focus:border-blue-500 focus:outline-none"
                          />
                        ) : (
                          <span className="text-2xl font-bold text-blue-400">{vote.value}</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-neutral-700 rounded-full h-2 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                              style={{
                                width: `${stats.totalVotes > 0 ? (vote.value / stats.totalVotes) * 100 : 0}%`,
                              }}
                            />
                          </div>
                          <span className="text-sm text-neutral-400 w-12">
                            {stats.totalVotes > 0 ? ((vote.value / stats.totalVotes) * 100).toFixed(1) : 0}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {editingId === vote.id ? (
                            <>
                              <button
                                onClick={saveEdit}
                                className="p-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                                title="Salvar"
                              >
                                <MdSave className="text-lg" />
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="p-2 bg-neutral-600 hover:bg-neutral-500 rounded-lg transition-colors"
                                title="Cancelar"
                              >
                                <MdClose className="text-lg" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEdit(vote)}
                                className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                                title="Editar"
                              >
                                <MdEdit className="text-lg" />
                              </button>
                              <button
                                onClick={() => handleDelete(vote.id, vote.name)}
                                className="p-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                                title="Deletar"
                              >
                                <MdDelete className="text-lg" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
