const API_IP = "10.110.228.127";
const BASE_URL = `http://${API_IP}:8000`;

export const ingredientService = {
  // Récupérer tous les ingrédients
  getAll: async () => {
    const response = await fetch(`${BASE_URL}/ingredients`);
    return await response.json();
  },

  create: async (ingredientData) => {
    const response = await fetch(`${BASE_URL}/ingredients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: ingredientData.name,
        quantity: ingredientData.quantity,
        unit: ingredientData.unit || "pcs",
      }),
    });
    return await response.json();
  },

  // Supprimer un ingrédient
  delete: async (id) => {
    const response = await fetch(`${BASE_URL}/ingredients/${id}`, {
      method: 'DELETE',
    });
    return response.ok;
  }
};

export const equipmentService = {
  getAll: async () => {
    const response = await fetch(`${BASE_URL}/equipments`);
    return await response.json();
  },
  create: async (name) => {
    const response = await fetch(`${BASE_URL}/equipments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name }),
    });
    return await response.json();
  },
  toggle: async (id) => {
    const response = await fetch(`${BASE_URL}/equipments/${id}`, {
      method: 'PATCH',
    });
    return await response.json();
  }
};

export const aiService = {
  // Correction : On passe en POST et on accepte la sélection
  getSuggestions: async (selection) => {
    try {
      const response = await fetch(`${BASE_URL}/generate-ideas`, {
        method: 'POST', // Impératif pour correspondre au Backend
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selection) // On envoie {ingredients: [], equipment: []}
      });
      return await response.json();
    } catch (error) {
      console.error("Erreur suggestions:", error);
      throw error;
    }
  },

  getRecipeDetails: async (recipeTitle) => {
    const response = await fetch(`${BASE_URL}/recipe-details?title=${encodeURIComponent(recipeTitle)}`);
    return await response.json();
  },

  saveFavorite: async (recipeData) => {
    const response = await fetch(`${BASE_URL}/favorites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: recipeData.title,
        details: recipeData 
      }),
    });
    return await response.json();
  },

  getFavorites: async () => {
    const response = await fetch(`${BASE_URL}/favorites`);
    return await response.json();
  },

  deleteFavorite: async (id) => {
    try {
      const response = await fetch(`${BASE_URL}/favorites/${id}`, {
        method: 'DELETE',
      });
      return await response.json();
    } catch (error) {
      console.error("Erreur suppression favori:", error);
      throw error;
    }
  }
};