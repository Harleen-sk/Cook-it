import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  FlatList, 
  TextInput, 
  TouchableOpacity, 
  SafeAreaView, 
  KeyboardAvoidingView, 
  Platform,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Importation de notre nouveau service
import { ingredientService } from './src/services/api';

export default function App() {
  // --- ÉTATS (STATE) ---
  const [ingredients, setIngredients] = useState([]);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [loading, setLoading] = useState(true);

  // --- LOGIQUE (FUNCTIONS) ---

  // Charger les données au démarrage
  const loadIngredients = async () => {
    setLoading(true);
    try {
      const data = await ingredientService.getAll();
      setIngredients(data);
    } catch (error) {
      console.error("Erreur de chargement:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIngredients();
  }, []);

  // Ajouter un ingrédient
  const handleAdd = async () => {
    if (!name || !quantity) return;

    const newIngredient = {
      name: name,
      quantity: parseFloat(quantity),
      unit: "pcs", // Unité par défaut
      is_staple: false
    };

    const result = await ingredientService.create(newIngredient);
    
    if (result && !result.detail) { // Vérifie que l'API n'a pas renvoyé d'erreur
      setName('');
      setQuantity('');
      loadIngredients(); // On rafraîchit la liste
    } else {
      alert("Erreur : " + (result?.detail || "Impossible d'ajouter"));
    }
  };

  // Supprimer un ingrédient
  const handleDelete = async (id) => {
    const success = await ingredientService.delete(id);
    if (success) {
      // Mise à jour locale immédiate pour une sensation de rapidité
      setIngredients(prev => prev.filter(item => item.id !== id));
    }
  };

  // --- RENDU (UI) ---

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        {/* En-tête Style Notion */}
        <View style={styles.header}>
          <Text style={styles.title}>🥕 My Pantry</Text>
          <Text style={styles.subtitle}>Clean & minimalist inventory</Text>
        </View>

        {/* Corps de la page */}
        {loading ? (
          <ActivityIndicator size="large" color="#1A1A1A" style={{ marginTop: 50 }} />
        ) : (
          <FlatList
            data={ingredients}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <View style={styles.ingredientCard}>
                <View>
                  <Text style={styles.ingredientName}>{item.name}</Text>
                  <Text style={styles.ingredientDetails}>{item.quantity} {item.unit}</Text>
                </View>
                
                <TouchableOpacity onPress={() => handleDelete(item.id)}>
                  <Ionicons name="trash-outline" size={20} color="#FF4444" />
                </TouchableOpacity>
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No ingredients yet. Add one below!</Text>
            }
          />
        )}

        {/* Barre de saisie fixe en bas */}
        <View style={styles.footer}>
          <View style={styles.inputContainer}>
            <TextInput 
              style={[styles.input, { flex: 2 }]} 
              placeholder="Ingredient..." 
              value={name}
              onChangeText={setName}
            />
            <TextInput 
              style={[styles.input, { flex: 1 }]} 
              placeholder="Qty" 
              keyboardType="numeric"
              value={quantity}
              onChangeText={setQuantity}
            />
            <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
              <Ionicons name="add" size={24} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// --- STYLES ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { padding: 25, paddingTop: 30 },
  title: { fontSize: 32, fontWeight: '800', color: '#1A1A1A', letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: '#888', marginTop: 4 },
  listContent: { paddingHorizontal: 25, paddingBottom: 120 },
  
  ingredientCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 18,
    borderBottomWidth: 0.5,
    borderBottomColor: '#EAEAEA',
  },
  ingredientName: { fontSize: 17, color: '#333', fontWeight: '500' },
  ingredientDetails: { fontSize: 14, color: '#999', marginTop: 2 },

  footer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  inputContainer: { flexDirection: 'row', gap: 12 },
  input: {
    backgroundColor: '#F9F9F9',
    padding: 14,
    borderRadius: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  addButton: {
    backgroundColor: '#1A1A1A',
    width: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2, // Ombre sur Android
    shadowColor: '#000', // Ombre sur iOS
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  emptyText: { textAlign: 'center', color: '#BBB', marginTop: 40, fontSize: 16 },
});