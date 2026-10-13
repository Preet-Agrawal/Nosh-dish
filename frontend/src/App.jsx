import { useEffect, useState } from 'react';
import { fetchDishes } from './api';
import DishList from './components/DishList';

export default function App() {
  // dishes = the SAVED dishes as the server knows them (drafts live inside each card)
  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [connectionLost, setConnectionLost] = useState(false);

  function loadDishes() {
    setLoading(true);
    setError('');
    fetchDishes()
      .then(setDishes)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(loadDishes, []);

  // Poll every 5 seconds so changes made elsewhere show up
  useEffect(() => {
    const timer = setInterval(() => {
      fetchDishes()
        .then((latest) => {
          setConnectionLost(false);
          setError(''); // a successful poll also clears a failed initial load
          // A poll can start before a save finishes and arrive after it.
          // Never let an older version overwrite a newer one we already have.
          setDishes((current) =>
            latest.map((d) => {
              const existing = current.find((c) => c.dishId === d.dishId);
              return existing && existing.version > d.version ? existing : d;
            })
          );
        })
        .catch(() => setConnectionLost(true)); // keep showing old data, just warn
    }, 5000);

    // Cleanup: stop polling when the component unmounts
    return () => clearInterval(timer);
  }, []);

  // Called by a card after a successful save (or "Reload latest")
  function handleDishSaved(updated) {
    // Never replace a dish with an older version
    setDishes((current) =>
      current.map((d) => (d.dishId === updated.dishId && updated.version >= d.version ? updated : d))
    );
  }

  return (
    <main className="app">
      <h1>Nosh Dish Dashboard</h1>

      {connectionLost && <div className="banner">Connection lost, retrying…</div>}

      {loading && <p>Loading dishes…</p>}

      {!loading && error && (
        <div className="error-box">
          <p>{error}</p>
          <button onClick={loadDishes}>Retry</button>
        </div>
      )}

      {!loading && !error && dishes.length === 0 && <p>No dishes found.</p>}

      {!loading && !error && dishes.length > 0 && (
        <DishList dishes={dishes} onDishSaved={handleDishSaved} />
      )}
    </main>
  );
}
