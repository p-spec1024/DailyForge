import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

export default function Register({ onRegister }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await onRegister(email, password, name);
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="container auth-page">
      <h1>DailyForge</h1>
      <p className="tagline">Create your account</p>
      <form onSubmit={handleSubmit} className="auth-form">
        <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p className="auth-error">{error}</p>}
        <button type="submit">Sign Up</button>
        <p className="auth-link">
          Have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  );
}
