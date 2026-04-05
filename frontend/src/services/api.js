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
  // Fonction pour les 3 idées de base
  getSuggestions: async () => {
    try {
      const response = await fetch(`${BASE_URL}/generate-ideas`);
      return await response.json();
    } catch (error) {
      console.error("Erreur suggestions:", error);
      throw error;
    }
  },

  // Fonction pour le détail complet (Celle qui manquait à l'objet)
  getRecipeDetails: async (recipeTitle) => {
    try {
      const response = await fetch(`${BASE_URL}/recipe-details?title=${encodeURIComponent(recipeTitle)}`);
      
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error("Erreur détails recette:", error);
      throw error; // On propage l'erreur pour que l'App.js la capture
    }
  }
};