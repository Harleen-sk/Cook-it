const API_IP = "10.110.228.127";
const BASE_URL = `http://${API_IP}:8000`;

export const ingredientService = {
  // Récupérer tous les ingrédients
  getAll: async () => {
    const response = await fetch(`${BASE_URL}/ingredients`);
    return await response.json();
  },

  // Ajouter un ingrédient
  create: async (ingredientData) => {
    const response = await fetch(`${BASE_URL}/ingredients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ingredientData),
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