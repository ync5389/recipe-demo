import React, { useState, useRef } from 'react';
import { projectId, publicAnonKey } from './utils/supabase/info';
import './styles/app.css';

interface Recipe {
  id?: string;
  name: string;
  cookingTime: string;
  difficulty: string;
  ingredients: string[];
  instructions: string[];
  nutrition: string;
  createdAt?: string;
  originalIngredients?: string[];
  isGeneratedWithFallback?: boolean;
  quotaExceeded?: boolean;
  apiError?: boolean;
  isGeneratedWithOpenAI?: boolean;
}

export default function App() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [detectedIngredients, setDetectedIngredients] = useState<string[]>([]);
  const [generatedRecipe, setGeneratedRecipe] = useState<Recipe | null>(null);
  const [recipeHistory, setRecipeHistory] = useState<Recipe[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [activeTab, setActiveTab] = useState<'detect' | 'history'>('detect');
  const [message, setMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [showCamera, setShowCamera] = useState(false);

  const serverUrl = `https://${projectId}.supabase.co/functions/v1/make-server-f4e18bc8`;

  const showMessage = (msg: string, type: 'success' | 'error' = 'success') => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 3000);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      setCameraStream(stream);
      setShowCamera(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      showMessage('Failed to access camera. Please try uploading an image instead.', 'error');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      if (context) {
        context.drawImage(video, 0, 0);
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        setSelectedImage(imageData);
        stopCamera();
        detectIngredients(imageData);
      }
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageData = e.target?.result as string;
        setSelectedImage(imageData);
        detectIngredients(imageData);
      };
      reader.readAsDataURL(file);
    }
  };

  const detectIngredients = async (imageData: string) => {
    setIsDetecting(true);
    setDetectedIngredients([]);
    setGeneratedRecipe(null);
    setError(null);
    setUsingFallback(false);
    setQuotaExceeded(false);

    try {
      console.log('Calling detect-ingredients endpoint...');
      const response = await fetch(`${serverUrl}/detect-ingredients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({ imageData }),
      });

      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server response:', errorText);
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Response data:', data);

      if (data.success) {
        setDetectedIngredients(data.ingredients);
        showMessage(`Detected ${data.ingredients.length} ingredients!`);
      } else {
        throw new Error(data.error || 'Failed to detect ingredients');
      }
    } catch (error) {
      console.error('Error detecting ingredients:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to detect ingredients. Please try again.';
      setError(errorMessage);
      showMessage(errorMessage, 'error');
    } finally {
      setIsDetecting(false);
    }
  };

  const generateRecipe = async () => {
    if (detectedIngredients.length === 0) {
      showMessage('No ingredients detected. Please upload an image first.', 'error');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setUsingFallback(false);
    setQuotaExceeded(false);

    try {
      console.log('Calling generate-recipe endpoint with ingredients:', detectedIngredients);
      const response = await fetch(`${serverUrl}/generate-recipe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({ 
          ingredients: detectedIngredients,
          detectionId: `detection_${Date.now()}`
        }),
      });

      console.log('Generate recipe response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Generate recipe server response:', errorText);
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Generate recipe response data:', data);

      if (data.success) {
        setGeneratedRecipe(data.recipe);
        setUsingFallback(data.usingFallback || false);
        setQuotaExceeded(data.quotaExceeded || false);
        
        if (data.quotaExceeded) {
          showMessage('OpenAI quota exceeded. Recipe generated using fallback mode.', 'error');
        } else if (data.usingFallback) {
          showMessage('Recipe generated using fallback mode.');
        } else {
          showMessage('Recipe generated successfully!');
        }
        
        loadRecipeHistory(); // Refresh history
      } else {
        throw new Error(data.error || 'Failed to generate recipe');
      }
    } catch (error) {
      console.error('Error generating recipe:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate recipe. Please try again.';
      setError(errorMessage);
      showMessage(errorMessage, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const loadRecipeHistory = async () => {
    setIsLoadingHistory(true);
    setError(null);

    try {
      console.log('Loading recipe history...');
      const response = await fetch(`${serverUrl}/recipes`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
      });

      console.log('Recipe history response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Recipe history server response:', errorText);
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Recipe history response data:', data);

      if (data.success) {
        setRecipeHistory(data.recipes || []);
      } else {
        throw new Error(data.error || 'Failed to load recipe history');
      }
    } catch (error) {
      console.error('Error loading recipe history:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load recipe history.';
      setError(errorMessage);
      showMessage(errorMessage, 'error');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const testServerConnection = async () => {
    try {
      console.log('Testing server connection...');
      const response = await fetch(`${serverUrl}/health`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Server health check:', data);
        const statusMessage = data.openaiConfigured 
          ? 'Server connection successful! OpenAI is configured.' 
          : 'Server connection successful! Running in fallback mode (OpenAI not configured).';
        showMessage(statusMessage);
      } else {
        throw new Error(`Server not responding: ${response.status}`);
      }
    } catch (error) {
      console.error('Server connection test failed:', error);
      showMessage('Server connection failed', 'error');
    }
  };

  const getDifficultyClass = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'easy': return 'badge badge-easy';
      case 'medium': return 'badge badge-medium';
      case 'hard': return 'badge badge-hard';
      default: return 'badge badge-default';
    }
  };

  React.useEffect(() => {
    loadRecipeHistory();
  }, []);

  return (
    <div className="app-container">
      <div className="main-content">
        {/* Header */}
        <header className="header">
          <div className="header-title">
            <span className="header-icon">👨‍🍳</span>
            <h1>Smart Recipe Chef</h1>
          </div>
          <p className="header-subtitle">
            Upload a photo of your ingredients and get AI-powered recipe suggestions
          </p>
          <button onClick={testServerConnection} className="test-btn">
            Test Server Connection
          </button>
        </header>

        {/* Message Display */}
        {message && (
          <div className="alert alert-info">
            {message}
          </div>
        )}

        {/* Quota Exceeded Alert */}
        {quotaExceeded && (
          <div className="alert alert-warning">
            <span className="alert-icon">ℹ️</span>
            <div>
              <strong>OpenAI Quota Exceeded:</strong> Your OpenAI account has exceeded its quota limit. 
              Recipes are being generated using our fallback system. To get AI-powered recipes, please 
              check your OpenAI account billing and add credits at{' '}
              <a 
                href="https://platform.openai.com/account/billing" 
                target="_blank" 
                rel="noopener noreferrer"
                className="link"
              >
                platform.openai.com/account/billing
              </a>
            </div>
          </div>
        )}

        {/* Fallback Mode Alert */}
        {usingFallback && !quotaExceeded && (
          <div className="alert alert-info">
            <span className="alert-icon">ℹ️</span>
            <div>
              <strong>Fallback Mode:</strong> Recipes are being generated using our backup system. 
              AI-powered recipes may be temporarily unavailable.
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="alert alert-error">
            <span className="alert-icon">⚠️</span>
            <div>{error}</div>
          </div>
        )}

        {/* Main Content */}
        <main className="main-section">
          {/* Tabs */}
          <div className="tabs-container">
            <div className="tabs-header">
              <button
                onClick={() => setActiveTab('detect')}
                className={`tab-button ${activeTab === 'detect' ? 'tab-active' : ''}`}
              >
                <span className="tab-icon">📷</span>
                Detect & Cook
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`tab-button ${activeTab === 'history' ? 'tab-active' : ''}`}
              >
                <span className="tab-icon">📚</span>
                Recipe History
              </button>
            </div>

            {activeTab === 'detect' && (
              <div className="tab-content">
                {/* Image Capture/Upload */}
                <section className="card">
                  <div className="card-header">
                    <h2>
                      <span className="section-icon">📷</span>
                      Capture Ingredients
                    </h2>
                  </div>
                  
                  <div className="card-body">
                    <div className="button-group">
                      <button onClick={startCamera} className="btn btn-secondary">
                        <span className="btn-icon">📷</span>
                        Use Camera
                      </button>
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="btn btn-secondary"
                      >
                        <span className="btn-icon">📁</span>
                        Upload Image
                      </button>
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      style={{ display: 'none' }}
                    />

                    {showCamera && (
                      <div className="camera-container">
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          className="camera-video"
                        />
                        <div className="camera-controls">
                          <button onClick={capturePhoto} className="btn btn-primary">
                            Capture Photo
                          </button>
                          <button onClick={stopCamera} className="btn btn-secondary">
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    <canvas ref={canvasRef} style={{ display: 'none' }} />

                    {selectedImage && (
                      <div className="image-preview">
                        <img
                          src={selectedImage}
                          alt="Selected ingredients"
                          className="preview-image"
                        />
                      </div>
                    )}
                  </div>
                </section>

                {/* Detected Ingredients */}
                {(isDetecting || detectedIngredients.length > 0) && (
                  <section className="card">
                    <div className="card-header">
                      <h2>
                        <span className="section-icon">🥄</span>
                        Detected Ingredients
                      </h2>
                    </div>
                    
                    {isDetecting ? (
                      <div className="loading-container">
                        <div className="spinner"></div>
                        <span>Detecting ingredients...</span>
                      </div>
                    ) : (
                      <div className="card-body">
                        <div className="ingredient-tags">
                          {detectedIngredients.map((ingredient, index) => (
                            <span key={index} className="ingredient-tag">
                              {ingredient}
                            </span>
                          ))}
                        </div>
                        <button 
                          onClick={generateRecipe}
                          disabled={isGenerating}
                          className="btn btn-primary btn-full"
                        >
                          {isGenerating ? (
                            <>
                              <div className="btn-spinner"></div>
                              Generating Recipe...
                            </>
                          ) : (
                            'Generate Recipe'
                          )}
                        </button>
                      </div>
                    )}
                  </section>
                )}

                {/* Generated Recipe */}
                {generatedRecipe && (
                  <section className="card">
                    <div className="card-header">
                      <div className="recipe-header">
                        <div className="recipe-title">
                          <h2>
                            <span className="section-icon">⭐</span>
                            {generatedRecipe.name}
                          </h2>
                        </div>
                        <div className="recipe-badges">
                          {(generatedRecipe.isGeneratedWithFallback || generatedRecipe.quotaExceeded || generatedRecipe.apiError) && (
                            <span className="badge badge-outline">
                              Fallback Mode
                            </span>
                          )}
                          {generatedRecipe.isGeneratedWithOpenAI && (
                            <span className="badge badge-success">
                              AI Generated
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="recipe-meta">
                        <div className="meta-item">
                          <span className="meta-icon">⏱️</span>
                          <span>{generatedRecipe.cookingTime}</span>
                        </div>
                        <span className={getDifficultyClass(generatedRecipe.difficulty)}>
                          {generatedRecipe.difficulty}
                        </span>
                      </div>
                    </div>
                    
                    <div className="card-body">
                      <div className="recipe-section">
                        <h3>Ingredients:</h3>
                        <ul className="ingredients-list">
                          {generatedRecipe.ingredients.map((ingredient, index) => (
                            <li key={index}>{ingredient}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="recipe-section">
                        <h3>Instructions:</h3>
                        <ol className="instructions-list">
                          {generatedRecipe.instructions.map((step, index) => (
                            <li key={index}>{step}</li>
                          ))}
                        </ol>
                      </div>

                      <div className="nutrition-section">
                        <h4>Nutritional Highlights:</h4>
                        <p>{generatedRecipe.nutrition}</p>
                      </div>
                    </div>
                  </section>
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <section className="card">
                <div className="card-header">
                  <div className="history-header">
                    <div className="header-left">
                      <h2>
                        <span className="section-icon">📚</span>
                        Recipe History
                      </h2>
                    </div>
                    <button 
                      onClick={loadRecipeHistory}
                      disabled={isLoadingHistory}
                      className="refresh-btn"
                      aria-label="Refresh recipe history"
                    >
                      <span className={`refresh-icon ${isLoadingHistory ? 'spinning' : ''}`}>🔄</span>
                    </button>
                  </div>
                </div>
                
                {isLoadingHistory ? (
                  <div className="loading-container">
                    <div className="spinner"></div>
                    <span>Loading recipes...</span>
                  </div>
                ) : (
                  <div className="history-container">
                    {recipeHistory.length === 0 ? (
                      <p className="empty-state">
                        No recipes generated yet. Start by detecting ingredients!
                      </p>
                    ) : (
                      <div className="history-list">
                        {recipeHistory.map((recipe) => (
                          <article key={recipe.id} className="history-item">
                            <div className="history-item-header">
                              <h3>{recipe.name}</h3>
                              <div className="history-badges">
                                <span className={getDifficultyClass(recipe.difficulty)}>
                                  {recipe.difficulty}
                                </span>
                                {(recipe.isGeneratedWithFallback || recipe.quotaExceeded || recipe.apiError) && (
                                  <span className="badge badge-outline">
                                    Fallback
                                  </span>
                                )}
                                {recipe.isGeneratedWithOpenAI && (
                                  <span className="badge badge-success">
                                    AI
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="history-meta">
                              <div className="meta-item">
                                <span className="meta-icon">⏱️</span>
                                <span>{recipe.cookingTime}</span>
                              </div>
                              {recipe.createdAt && (
                                <span className="date">
                                  {new Date(recipe.createdAt).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                            <p className="history-ingredients">
                              <strong>Ingredients:</strong> {(recipe.originalIngredients || recipe.ingredients)?.slice(0, 3).join(', ')}
                              {(recipe.originalIngredients || recipe.ingredients)?.length > 3 && '...'}
                            </p>
                            <p className="history-nutrition">{recipe.nutrition}</p>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}