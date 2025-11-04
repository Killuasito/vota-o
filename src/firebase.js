import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
 apiKey: "AIzaSyBERn3asXZl4A58qZmKYOdAQ2ls60UYFys",
  authDomain: "votacao-70c19.firebaseapp.com",
  projectId: "votacao-70c19",
  storageBucket: "votacao-70c19.firebasestorage.app",
  messagingSenderId: "423410869463",
  appId: "1:423410869463:web:1a32df7b9a37cb00ce7c92",
  measurementId: "G-T5Q0TQ6VL6"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
