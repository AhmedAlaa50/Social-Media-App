import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Feed from "./components/Feed";
import Profile from "./components/Profile";
import PostDetail from "./components/PostDetail";
import Auth from "./components/Auth";
import FriendRequests from "./components/FriendRequests";
import Friends from "./components/Friends";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { useAuth } from "./context/AuthContext";

function AppContent() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        {user && <FriendRequests />}
        <Routes>
          <Route path="/" element={<Feed />} />
          <Route path="/profile/:id" element={<Profile />} />
          <Route path="/post/:id" element={<PostDetail />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/friends" element={<Friends />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <Router>
          <AppContent />
        </Router>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
