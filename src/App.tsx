import React, { useState } from 'react'
import { ImageUpload } from './components/ImageUpload'
import { IngredientsDisplay } from './components/IngredientsDisplay'
import { RecipeDisplay } from './components/RecipeDisplay'
import { LoadingSpinner } from './components/LoadingSpinner'
import { projectId, publicAnonKey } from './utils/supabase/info'
import './styles/App.css'

interface AppState {
  ingredients: string
  recipe: string
  isAnalyzing: boolean
  isGenerating: boolean
  error: string
}

function App() {
  const [state, setState] = useState<AppState>({
    ingredients: '',
    recipe: '',
    isAnalyzing: false,
    isGenerating: false,
    error: ''
  })

  const analyzeImage = async (file: File) => {
    setState(prev => ({ ...prev, isAnalyzing: true, error: '', ingredients: '', recipe: '' }))

    try {
      const formData = new FormData()
      formData.append('image', file)

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-f248e63b/analyze-ingredients`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: formData
        }
      )

      if (!response.ok) {
        throw new Error(`Failed to analyze image: ${response.statusText}`)
      }

      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error)
      }

      setState(prev => ({ ...prev, ingredients: data.ingredients, isAnalyzing: false }))
    } catch (error) {
      console.error('Error analyzing image:', error)
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to analyze image',
        isAnalyzing: false 
      }))
    }
  }

  const generateRecipe = async () => {
    if (!state.ingredients) return

    setState(prev => ({ ...prev, isGenerating: true, error: '', recipe: '' }))

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-f248e63b/generate-recipe`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ ingredients: state.ingredients })
        }
      )

      if (!response.ok) {
        throw new Error(`Failed to generate recipe: ${response.statusText}`)
      }

      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error)
      }

      setState(prev => ({ ...prev, recipe: data.recipe, isGenerating: false }))
    } catch (error) {
      console.error('Error generating recipe:', error)
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to generate recipe',
        isGenerating: false 
      }))
    }
  }

  const resetApp = () => {
    setState({
      ingredients: '',
      recipe: '',
      isAnalyzing: false,
      isGenerating: false,
      error: ''
    })
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>🍳 AI Recipe Generator</h1>
        <p>Upload a photo of your ingredients and get a custom recipe!</p>
      </header>

      <main className="app-main">
        <div className="container">
          {state.error && (
            <div className="error-message">
              <span>❌ {state.error}</span>
              <button onClick={resetApp} className="retry-button">Try Again</button>
            </div>
          )}

          <div className="upload-section">
            <ImageUpload 
              onImageUpload={analyzeImage} 
              isAnalyzing={state.isAnalyzing}
              disabled={state.isAnalyzing || state.isGenerating}
            />
          </div>

          {state.isAnalyzing && (
            <div className="loading-section">
              <LoadingSpinner />
              <p>Analyzing your ingredients...</p>
            </div>
          )}

          {state.ingredients && !state.isAnalyzing && (
            <div className="ingredients-section">
              <IngredientsDisplay 
                ingredients={state.ingredients}
                onGenerateRecipe={generateRecipe}
                isGenerating={state.isGenerating}
              />
            </div>
          )}

          {state.isGenerating && (
            <div className="loading-section">
              <LoadingSpinner />
              <p>Creating your custom recipe...</p>
            </div>
          )}

          {state.recipe && !state.isGenerating && (
            <div className="recipe-section">
              <RecipeDisplay recipe={state.recipe} onStartOver={resetApp} />
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default App