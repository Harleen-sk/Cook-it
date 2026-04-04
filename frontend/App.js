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
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Importation du service API
import { ingredientService } from './src/services/api';

export default function App() {
  // --- ÉTATS (STATE) ---
  const [ingredients, setIngredients] = useState([]);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [loading, setLoading] = useState(true);

  // --- LOGIQUE (FUNCTIONS) ---

  // Charger les données depuis le serveur
  const loadIngredients = async () => {
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

  // Ajouter un ingrédient (Tri automatique géré par le backend)
  const handleAdd = async () => {
    if (!name || !quantity) return;

    // On envoie juste nom et quantité, le backend fera la reconnaissance
    const newIngredient = {
      name: name.trim(),
      quantity: parseFloat(quantity),
      unit: "pcs"
    };

    const result = await ingredientService.create(newIngredient);
    
    if (result && !result.detail) {
      setName('');
      setQuantity('');
      loadIngredients(); 
    } else {
      Alert.alert("Erreur", result?.detail || "Impossible d'ajouter l'ingrédient");
    }
  };

  // Supprimer un ingrédient
  const handleDelete = async (id) => {
    const success = await ingredientService.delete(id);
    if (success) {
      setIngredients(prev => prev.filter(item => item.id !== id));
    }
  };

  // Séparation automatique des données pour l'affichage
  const freshIngredients = ingredients.filter(i => !i.is_staple);
  const stapleIngredients = ingredients.filter(i => i.is_staple);

  // --- RENDU (UI) ---

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        {/* En-tête minimalist */}
        <View style={styles.header}>
          <Text style={styles.title}>🥕 My Pantry</Text>
          <Text style={styles.subtitle}>Smart automatic sorting</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#1A1A1A" style={{ marginTop: 50 }} />
        ) : (
          <FlatList
            data={[
              { title: 'Fresh Ingredients', data: freshIngredients },
              { title: 'Basics & Staples', data: stapleIngredients }
            ]}
            keyExtractor={(item) => item.title}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>{item.title}</Text>
                {item.data.length === 0 ? (
                  <Text style={styles.emptyText}>No items here</Text>
                ) : (
                  item.data.map(ing => (
                    <View key={ing.id} style={styles.ingredientCard}>
                      <View>
                        <Text style={styles.ingredientName}>{ing.name}</Text>
                        <Text style={styles.ingredientDetails}>{ing.quantity} {ing.unit}</Text>
                      </View>
                      <TouchableOpacity onPress={() => handleDelete(ing.id)}>
                        <Ionicons name="trash-outline" size={20} color="#FF4444" />
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
            )}
          />
        )}

        {/* Formulaire de saisie simplifié */}
        <View style={styles.footer}>
          <View style={styles.inputContainer}>
            <TextInput 
              style={[styles.input, { flex: 2 }]} 
              placeholder="Ex: Salt, Tomato..." 
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
  header: { padding: 25, paddingTop: 20 },
  title: { fontSize: 28, fontWeight: '800', color: '#1A1A1A' },
  subtitle: { fontSize: 14, color: '#AAA', marginTop: 4 },
  
  listContent: { paddingHorizontal: 25, paddingBottom: 120 },
  sectionContainer: { marginBottom: 30 },
  sectionTitle: { 
    fontSize: 13, 
    fontWeight: '700', 
    color: '#BBB', 
    textTransform: 'uppercase', 
    letterSpacing: 1,
    marginBottom: 10 
  },
  
  ingredientCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F0',
  },
  ingredientName: { fontSize: 16, color: '#333', fontWeight: '500', textTransform: 'capitalize' },
  ingredientDetails: { fontSize: 12, color: '#999', marginTop: 2 },

  footer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 25,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
  },
  inputContainer: { flexDirection: 'row', gap: 10 },
  input: {
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 10,
    fontSize: 15,
  },
  addButton: {
    backgroundColor: '#1A1A1A',
    width: 50,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: { color: '#EEE', fontSize: 14, fontStyle: 'italic', marginVertical: 10 },
});