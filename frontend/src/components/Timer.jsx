import { useEffect, useState } from 'react';

// Countdown banner used on the checkout page while a seat hold is active.
export default function Timer({ expiresAt, onExpire }) {
  const [remaining, setRemaining] = useState(Math.max(0, new Date(expiresAt) - Date.now()));

  useEffect(() => {
    const interval = setInterval(() => {
      const left = Math.max(0, new Date(expiresAt) - Date.now());
      setRemaining(left);
      if (left <= 0) { clearInterval(interval); onExpire?.(); }
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, onExpire]);

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);

  return (
    <div className="timer-banner">
      Your seats are held for {minutes}:{seconds.toString().padStart(2, '0')} — complete checkout before the hold expires
    </div>
  );
}
