import DishCard from './DishCard';

export default function DishList({ dishes, onDishSaved }) {
  return (
    <div className="dish-grid">
      {dishes.map((dish) => (
        <DishCard key={dish.dishId} dish={dish} onSaved={onDishSaved} />
      ))}
    </div>
  );
}
