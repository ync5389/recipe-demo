import React from 'react'

interface IngredientsDisplayProps {
  ingredients: string
  onGenerateRecipe: () => void
  isGenerating: boolean
}

export function IngredientsDisplay({ 
  ingredients, 
  onGenerateRecipe, 
  isGenerating 
}: IngredientsDisplayProps) {
  return (
    <div className="ingredients-display">
      <h2>🥬 Detected Ingredients</h2>
      
      <div className="ingredients-list">
        <div className="ingredients-text">
          {ingredients}
        </div>
      </div>
      
      <button 
        className="generate-button"
        onClick={onGenerateRecipe}
        disabled={isGenerating}
      >
        {isGenerating ? 'Generating Recipe...' : '🍳 Generate Recipe'}
      </button>
    </div>
  )
}