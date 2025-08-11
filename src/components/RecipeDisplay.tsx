import React from 'react'

interface RecipeDisplayProps {
  recipe: string
  onStartOver: () => void
}

export function RecipeDisplay({ recipe, onStartOver }: RecipeDisplayProps) {
  return (
    <div className="recipe-display">
      <h2>👨‍🍳 Your Custom Recipe</h2>
      
      <div className="recipe-content">
        <div className="recipe-text">
          {recipe}
        </div>
      </div>
      
      <button 
        className="start-over-button"
        onClick={onStartOver}
      >
        🔄 Start Over
      </button>
    </div>
  )
}