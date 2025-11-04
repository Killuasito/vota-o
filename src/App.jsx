import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import { collection, doc, setDoc, onSnapshot, query, orderBy } from "firebase/firestore";
import WordCloud from "react-d3-cloud";
import { HiCheckCircle } from "react-icons/hi";
import { BiSend } from "react-icons/bi";
import { MdDarkMode, MdLightMode } from "react-icons/md";

export default function App() {
  const [voteName, setVoteName] = useState("");
  const [words, setWords] = useState([]);
  const [hasVoted, setHasVoted] = useState(false);
  const [userVote, setUserVote] = useState("");
  const [darkMode, setDarkMode] = useState(false);

  // Verifica se o usuário já votou
  useEffect(() => {
    const voted = localStorage.getItem("hasVoted");
    const vote = localStorage.getItem("userVote");
    const savedDarkMode = localStorage.getItem("darkMode") === "true";
    
    if (voted === "true" && vote) {
      setHasVoted(true);
      setUserVote(vote);
    }
    setDarkMode(savedDarkMode);
  }, []);

  // Escuta em tempo real os votos
  useEffect(() => {
    const q = query(collection(db, "votes"), orderBy("value", "desc"));
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        console.log("📊 Snapshot recebido! Total de docs:", snapshot.size);
        const updatedWords = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          console.log("Doc:", doc.id, "| Data:", data);
          const wordObj = {
            text: data.name || doc.id.replace(/_/g, " "), // nome legível ou fallback
            value: data.value,
          };
          console.log("➕ Adicionando:", wordObj);
          updatedWords.push(wordObj);
        });
        console.log("✅ Words atualizadas:", updatedWords);
        console.log("✅ Tamanho do array:", updatedWords.length);
        setWords(updatedWords);
      },
      (error) => {
        console.error("❌ Erro no listener:", error);
        alert("Erro ao escutar votos: " + error.message);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleVote = async () => {
    if (!voteName.trim()) return;
    if (hasVoted) {
      alert("Você já votou! Apenas um voto por pessoa.");
      return;
    }

    // Sanitiza o nome para usar como ID do documento
    const sanitizedId = voteName.trim().replace(/\s+/g, "_").toLowerCase();
    const docRef = doc(db, "votes", sanitizedId);

    // Procura voto existente
    const existing = words.find((w) => w.text.toLowerCase() === voteName.trim().toLowerCase());
    const newValue = (existing?.value || 0) + 1;

    console.log("Votando em:", voteName, "| Novo valor:", newValue);

    try {
      await setDoc(
        docRef,
        {
          name: voteName.trim(), // nome legível
          value: newValue,
        },
        { merge: true } // cria ou atualiza
      );
      console.log("Voto salvo com sucesso!");
      
      // Marca como votado no localStorage
      localStorage.setItem("hasVoted", "true");
      localStorage.setItem("userVote", voteName.trim());
      setHasVoted(true);
      setUserVote(voteName.trim());
      setVoteName("");
    } catch (err) {
      console.error("Erro ao votar:", err);
      alert("Erro ao votar: " + err.message);
    }
  };

  const fontSizeMapper = (word) => Math.log2(word.value + 2) * 25;
  const rotate = () => 0; // sem rotação para ficar mais compacto
  
  // Gera uma seed estável baseada nos dados para manter posições consistentes
  const cloudKey = words.map(w => `${w.text}:${w.value}`).sort().join('-');

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem("darkMode", newMode.toString());
  };

  return (
    <div className={`w-screen h-screen flex flex-col items-center justify-between p-6 transition-colors duration-300 ${
      darkMode ? 'bg-neutral-900 text-white' : 'bg-neutral-50 text-neutral-900'
    }`}>
      
      {/* Botão dark mode */}
      <button
        onClick={toggleDarkMode}
        className={`absolute top-4 right-4 p-2.5 rounded-full transition-all hover:scale-110 ${
          darkMode ? 'bg-neutral-800 text-yellow-400' : 'bg-white text-neutral-900 shadow-md'
        }`}
      >
        {darkMode ? <MdLightMode className="text-xl" /> : <MdDarkMode className="text-xl" />}
      </button>
      
      {/* Título minimalista */}
      <div className="text-center mt-4">
        <h1 className="text-4xl font-light tracking-tight mb-2">Votação Sarau</h1>
        <div className={`h-px w-24 mx-auto ${darkMode ? 'bg-neutral-700' : 'bg-neutral-300'}`}></div>
      </div>

      {/* Word Cloud */}
      <div className="flex items-center justify-center w-full flex-1 py-4">
        {words.length > 0 ? (
          <div className="w-full max-w-5xl h-full flex items-center justify-center relative">
            {words.map((word, i) => {
              const colors = [
                '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', 
                '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2', 
                '#FF85A2', '#95E1D3'
              ];
              
              // Calcula tamanho baseado nos votos
              const fontSize = Math.log2(word.value + 2) * 25;
              
              // Distribui palavras em círculo/espiral
              const angle = (i * 137.5 * Math.PI) / 180; // golden angle
              const radius = Math.sqrt(i + 1) * 60;
              const x = Math.cos(angle) * radius;
              const y = Math.sin(angle) * radius;
              
              return (
                <div
                  key={word.text}
                  className="absolute font-semibold transition-all duration-300 hover:scale-110 cursor-default animate-fadeIn"
                  style={{
                    fontSize: `${fontSize}px`,
                    color: colors[i % colors.length],
                    left: '50%',
                    top: '50%',
                    transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                    animationDelay: `${i * 0.1}s`,
                  }}
                >
                  {word.text}
                </div>
              );
            })}
          </div>
        ) : (
          <div className={`text-center ${darkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
            <p className="text-lg font-light">Nenhum voto registrado</p>
          </div>
        )}
      </div>

      {/* Campo de voto minimalista */}
      <div className="w-full max-w-md mb-4">
        {hasVoted ? (
          <div className={`flex items-center justify-center gap-2 py-3 ${
            darkMode ? 'text-neutral-400' : 'text-neutral-600'
          }`}>
            <HiCheckCircle className="text-xl" />
            <span className="font-light">Voto registrado em <strong className="font-medium">{userVote}</strong></span>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              value={voteName}
              onChange={(e) => setVoteName(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleVote()}
              className={`flex-1 border rounded-lg px-4 py-3 text-base focus:outline-none transition-colors ${
                darkMode 
                  ? 'bg-neutral-800 border-neutral-700 focus:border-neutral-500 placeholder-neutral-500 text-white' 
                  : 'bg-white border-neutral-300 focus:border-neutral-900 placeholder-neutral-400'
              }`}
              placeholder="Nome do participante"
            />
            <button
              onClick={handleVote}
              className={`px-5 rounded-lg transition-colors flex items-center justify-center ${
                darkMode 
                  ? 'bg-neutral-700 hover:bg-neutral-600 text-white' 
                  : 'bg-neutral-900 hover:bg-neutral-700 text-white'
              }`}
            >
              <BiSend className="text-xl" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
