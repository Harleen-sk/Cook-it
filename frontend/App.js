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
  Alert,
  Dimensions,
  Modal,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Importation de nos services
import { ingredientService, equipmentService, aiService } from './src/services/api';

const { width, height } = Dimensions.get('window');

export default function App() {
  // --- NAVIGATION ---
  const [currentScreen, setCurrentScreen] = useState('pantry'); 

  // --- ÉTATS DONNÉES ---
  const [ingredients, setIngredients] = useState([]);
  const [equipments, setEquipments] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState([]);
  
  // --- ÉTATS RECETTE DÉTAILLÉE ---
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [loadingRecipe, setLoadingRecipe] = useState(false);

  // --- ÉTATS FORMULAIRES ---
  const [ingName, setIngName] = useState('');
  const [ingQty, setIngQty] = useState('');
  const [ingUnit, setIngUnit] = useState('pcs');
  const [eqName, setEqName] = useState('');

  const availableUnits = ['pcs', 'g', 'kg', 'ml', 'l'];

  // --- CHARGEMENT INITIAL ---
  const loadAllData = async () => {
    setLoading(true);
    try {
      const [ingData, eqData] = await Promise.all([
        ingredientService.getAll(),
        equipmentService.getAll()
      ]);
      setIngredients(ingData);
      setEquipments(eqData);
      
      // Si c'est un nouvel utilisateur (pas d'équipement), on l'envoie configurer sa cuisine
      if (eqData.length === 0 && currentScreen === 'pantry') {
        setCurrentScreen('equipment');
      }
    } catch (error) {
      console.error("Erreur de synchro:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // --- LOGIQUE INGRÉDIENTS & ÉQUIPEMENTS ---
  const handleAddIngredient = async () => {
    if (!ingName || !ingQty) return;
    const result = await ingredientService.create({ 
      name: ingName, quantity: parseFloat(ingQty), unit: ingUnit 
    });
    if (result && !result.detail) {
      setIngName(''); setIngQty(''); setIngUnit('pcs');
      loadAllData();
    }
  };

  const handleAddEquipment = async () => {
    if (!eqName) return;
    const result = await equipmentService.create(eqName);
    if (result) { setEqName(''); loadAllData(); }
  };

  const handleToggleEquipment = async (id) => {
    const result = await equipmentService.toggle(id);
    if (result) {
      setEquipments(prev => prev.map(eq => eq.id === id ? { ...eq, is_active: !eq.is_active } : eq));
    }
  };

  // --- LOGIQUE IA ---
  const handleGenerateRecipes = async () => {
    setLoading(true);
    try {
      const data = await aiService.getSuggestions();
      setSuggestions(data.suggestions);
      setCurrentScreen('suggestions');
    } catch (e) {
      Alert.alert("Oups !", "Le chef IA est un peu fatigué.");
    } finally {
      setLoading(false);
    }
  };

  // NOUVEAU : Récupérer les détails d'une recette
  const handleViewRecipe = async (title) => {
    setLoadingRecipe(true);
    setModalVisible(true);
    try {
      const details = await aiService.getRecipeDetails(title);
      setSelectedRecipe(details);
    } catch (e) {
      setModalVisible(false);
      Alert.alert("Erreur", "Impossible de charger la recette.");
    } finally {
      setLoadingRecipe(false);
    }
  };

  const handleSaveFavorite = async () => {
    if (!selectedRecipe) return;
    
    try {
      await aiService.saveFavorite(selectedRecipe);
      Alert.alert("Succès !", "La recette a été ajoutée à tes favoris ❤️");
    } catch (e) {
      Alert.alert("Erreur", "Impossible de sauvegarder la recette.");
    }
  };

  const loadFavorites = async () => {
    try {
      const data = await aiService.getFavorites();
      setFavorites(data);
    } catch (e) {
      console.log("Erreur chargement favoris", e);
    }
  };

  // --- RENDUS D'ÉCRANS ---

  const renderPantry = () => (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>My Pantry</Text>
          <TouchableOpacity 
            style={[styles.settingsBtn, {marginRight: 10}]} 
            onPress={() => {
              loadFavorites();
              setCurrentScreen('favorites');
            }}
          >
            <Ionicons name="heart" size={22} color="#FF4444" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingsBtn} onPress={() => setCurrentScreen('equipment')}>
            <Ionicons name="cog-outline" size={22} color="#666" />
          </TouchableOpacity>
        </View>
        <Text style={styles.subtitle}>Manage your stock for AI cooking</Text>
      </View>

      <FlatList
        data={[
          { title: 'Fresh Ingredients', data: ingredients.filter(i => !i.is_staple) },
          { title: 'Basics & Staples', data: ingredients.filter(i => i.is_staple) }
        ]}
        contentContainerStyle={styles.listContent}
        keyExtractor={(item) => item.title}
        renderItem={({ item }) => (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>{item.title}</Text>
            {item.data.length === 0 ? <Text style={styles.emptyText}>Empty</Text> : 
              item.data.map(ing => (
                <View key={ing.id} style={styles.card}>
                  <View>
                    <Text style={styles.cardMainText}>{ing.name}</Text>
                    <Text style={styles.cardSubText}>{ing.quantity} {ing.unit}</Text>
                  </View>
                  <TouchableOpacity onPress={() => ingredientService.delete(ing.id).then(loadAllData)}>
                    <Ionicons name="trash-outline" size={18} color="#FF4444" />
                  </TouchableOpacity>
                </View>
              ))
            }
          </View>
        )}
      />
      {/* BOUTON GÉNÉRER*/}
      <TouchableOpacity style={styles.generateFab} onPress={handleGenerateRecipes}>
        <Text style={styles.generateFabText}>Generate Ideas</Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <View style={styles.unitSelector}>
          {availableUnits.map(u => (
            <TouchableOpacity key={u} style={[styles.unitBadge, ingUnit === u && styles.unitBadgeActive]} onPress={() => setIngUnit(u)}>
              <Text style={[styles.unitText, ingUnit === u && styles.unitTextActive]}>{u}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.inputContainer}>
          <TextInput style={[styles.input, { flex: 2 }]} placeholder="Ingredient..." value={ingName} onChangeText={setIngName} />
          <TextInput style={[styles.input, { flex: 1 }]} placeholder="Qty" keyboardType="numeric" value={ingQty} onChangeText={setIngQty} />
          <TouchableOpacity style={styles.addButton} onPress={handleAddIngredient}>
            <Ionicons name="add" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderEquipment = () => (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <Text style={styles.title}>Kitchen Tools</Text>
        <Text style={styles.subtitle}>Select or add what you have at home</Text>
      </View>
      <FlatList
        data={equipments}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={[styles.eqCard, !item.is_active && styles.eqCardInactive]} 
            onPress={() => handleToggleEquipment(item.id)}
          >
            <Text style={[styles.eqText, !item.is_active && styles.eqTextInactive]}>{item.name}</Text>
            <Ionicons name={item.is_active ? "checkmark-circle" : "ellipse-outline"} size={24} color={item.is_active ? "#1A1A1A" : "#DDD"} />
          </TouchableOpacity>
        )}
      />
      <View style={styles.footer}>
        <View style={styles.inputContainer}>
          <TextInput style={[styles.input, { flex: 1 }]} placeholder="Add tool (Oven, Pan...)" value={eqName} onChangeText={setEqName} />
          <TouchableOpacity style={styles.addButton} onPress={handleAddEquipment}>
            <Ionicons name="add" size={24} color="white" />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.doneBtn} onPress={() => setCurrentScreen('pantry')}>
          <Text style={styles.doneBtnText}>Go to Pantry</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFavorites = () => (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <Text style={styles.title}>❤️ Mes Favoris</Text>
        <Text style={styles.subtitle}>Tes recettes sauvegardées</Text>
      </View>

      <FlatList
        data={favorites}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.recipeCard}>
            <Text style={styles.recipeTitle}>{item.title}</Text>
            <Text style={styles.recipeDesc} numberOfLines={2}>
              {item.details.ingredients.length} ingrédients • {item.details.prep_time}
            </Text>
            <TouchableOpacity 
              style={styles.recipeBtn} 
              onPress={() => {
                setSelectedRecipe(item.details); // On réutilise la modal existante !
                setModalVisible(true);
              }}
            >
              <Text style={styles.recipeBtnText}>Voir la recette</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Aucun favori pour le moment.</Text>
        }
      />

      <TouchableOpacity style={styles.backFab} onPress={() => setCurrentScreen('pantry')}>
        <Ionicons name="arrow-back" size={20} color="white" />
        <Text style={{color: 'white', fontWeight: '700', marginLeft: 8}}>Retour</Text>
      </TouchableOpacity>
    </View>
  );

  const renderSuggestions = () => (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <Text style={styles.title}>AI Suggestions</Text>
        <Text style={styles.subtitle}>Recipes matching your inventory</Text>
      </View>
      <FlatList
        data={suggestions}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.recipeCard}>
            <View style={styles.recipeHeader}>
              <Text style={styles.recipeTitle}>{item.title}</Text>
              <Text style={styles.recipeScore}>{item.score}</Text>
            </View>
            <Text style={styles.recipeDesc}>{item.description}</Text>
            <TouchableOpacity 
              style={styles.recipeBtn} 
              onPress={() => handleViewRecipe(item.title)}
            >
              <Text style={styles.recipeBtnText}>Let's get started</Text>
            </TouchableOpacity>
          </View>
        )}
      />
      <TouchableOpacity style={styles.backFab} onPress={() => setCurrentScreen('pantry')}>
        <Ionicons name="arrow-back" size={20} color="white" />
        <Text style={{color: 'white', fontWeight: '700', marginLeft: 8}}>Back</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#1A1A1A" />
            <Text style={styles.loadingText}>Cooking something special...</Text>
          </View>
        ) : (
          currentScreen === 'pantry' ? renderPantry() : 
          currentScreen === 'equipment' ? renderEquipment() :
          currentScreen === 'favorites' ? renderFavorites() : 
          renderSuggestions()
        )}

        {/* MODAL POUR LE DÉTAIL DE LA RECETTE */}
        <Modal
          animationType="slide"
          visible={modalVisible}
          presentationStyle="pageSheet"
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalContent}>
            {loadingRecipe ? (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color="#1A1A1A" />
                <Text style={styles.loadingText}>Rédaction de la recette...</Text>
              </View>
            ) : selectedRecipe && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeader}>
                   <Text style={styles.modalTitle}>{selectedRecipe.title}</Text>
                   <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
                      {/* BOUTON SAUVEGARDER */}
                      <TouchableOpacity onPress={handleSaveFavorite}>
                        <Ionicons name="heart-outline" size={28} color="#FF4444" />
                      </TouchableOpacity>

                      <TouchableOpacity onPress={() => setModalVisible(false)}>
                        <Ionicons name="close-circle" size={30} color="#DDD" />
                      </TouchableOpacity>
                    </View>
                   <TouchableOpacity onPress={() => setModalVisible(false)}>
                      <Ionicons name="close-circle" size={30} color="#DDD" />
                   </TouchableOpacity>
                </View>

                <View style={styles.recipeInfoRow}>
                  <View style={styles.infoBadge}>
                    <Ionicons name="time-outline" size={16} color="#666" />
                    <Text style={styles.infoBadgeText}>{selectedRecipe.prep_time}</Text>
                  </View>
                  <View style={styles.infoBadge}>
                    <Ionicons name="stats-chart-outline" size={16} color="#666" />
                    <Text style={styles.infoBadgeText}>{selectedRecipe.difficulty}</Text>
                  </View>
                </View>

                <Text style={styles.modalSectionTitle}>Ingredients</Text>
                {selectedRecipe.ingredients.map((ing, idx) => (
                  <Text key={idx} style={styles.modalIngredient}>• {ing}</Text>
                ))}

                <Text style={styles.modalSectionTitle}>Instructions</Text>
                {selectedRecipe.instructions.map((step, idx) => (
                  <View key={idx} style={styles.stepRow}>
                    <View style={styles.stepNumberContainer}>
                      <Text style={styles.stepNumberText}>{idx + 1}</Text>
                    </View>
                    <Text style={styles.stepDescription}>{step}</Text>
                  </View>
                ))}

                <View style={{height: 50}} />
              </ScrollView>
            )}
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // ... GARDE TES STYLES EXISTANTS ...
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 25, paddingTop: 10 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: '#AAA', marginTop: 4 },
  settingsBtn: { backgroundColor: '#F5F5F5', padding: 8, borderRadius: 12 },
  listContent: { paddingHorizontal: 25, paddingBottom: 180 },
  sectionContainer: { marginBottom: 25 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#CCC', textTransform: 'uppercase', marginBottom: 10, letterSpacing: 1 },
  card: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 0.5, borderBottomColor: '#F0F0F0' },
  cardMainText: { fontSize: 16, fontWeight: '600', textTransform: 'capitalize' },
  cardSubText: { fontSize: 12, color: '#999', marginTop: 2 },
  eqCard: { flexDirection: 'row', justifyContent: 'space-between', padding: 18, backgroundColor: '#F9F9F9', borderRadius: 14, marginBottom: 12 },
  eqCardInactive: { opacity: 0.4, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#EEE' },
  eqText: { fontSize: 16, fontWeight: '600', textTransform: 'capitalize' },
  eqTextInactive: { color: '#AAA', textDecorationLine: 'line-through' },
  footer: { position: 'absolute', bottom: 0, width: '100%', padding: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 20, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#F5F5F5' },
  inputContainer: { flexDirection: 'row', gap: 10 },
  input: { backgroundColor: '#F5F5F5', padding: 12, borderRadius: 12, fontSize: 15 },
  addButton: { backgroundColor: '#1A1A1A', width: 52, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  unitSelector: { flexDirection: 'row', marginBottom: 12, gap: 8 },
  unitBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: '#F5F5F5' },
  unitBadgeActive: { backgroundColor: '#1A1A1A' },
  unitText: { fontSize: 11, fontWeight: '700', color: '#AAA' },
  unitTextActive: { color: '#FFF' },
  generateFab: { position: 'absolute', bottom: 130, right: 20, backgroundColor: '#1A1A1A', paddingHorizontal: 20, paddingVertical: 14, borderRadius: 30, flexDirection: 'row', alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10 },
  generateFabText: { color: 'white', fontWeight: '800', fontSize: 15 },
  backFab: { position: 'absolute', bottom: 30, alignSelf: 'center', backgroundColor: '#666', paddingHorizontal: 25, paddingVertical: 12, borderRadius: 25, flexDirection: 'row', alignItems: 'center' },
  recipeCard: { backgroundColor: '#F9F9F9', borderRadius: 18, padding: 20, marginBottom: 15, borderWidth: 1, borderColor: '#F0F0F0' },
  recipeHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  recipeTitle: { fontSize: 18, fontWeight: '700' },
  recipeScore: { color: '#4CAF50', fontWeight: '800', fontSize: 12 },
  recipeDesc: { color: '#666', fontSize: 14, lineHeight: 20, marginBottom: 15 },
  recipeBtn: { backgroundColor: '#1A1A1A', padding: 12, borderRadius: 10, alignItems: 'center' },
  recipeBtnText: { color: 'white', fontWeight: '700' },
  doneBtn: { backgroundColor: '#F0F9F0', padding: 15, borderRadius: 12, marginTop: 12, alignItems: 'center' },
  doneBtnText: { color: '#2D5A27', fontWeight: '700' },
  emptyText: { color: '#DDD', fontStyle: 'italic', marginVertical: 10 },
  loadingText: { marginTop: 20, fontSize: 18, fontWeight: '700', color: '#1A1A1A' },

  // --- NOUVEAUX STYLES POUR LA MODAL ---
  modalContent: { flex: 1, padding: 25, backgroundColor: 'white' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  modalTitle: { fontSize: 24, fontWeight: '800', width: '80%' },
  modalSectionTitle: { fontSize: 18, fontWeight: '700', marginTop: 25, marginBottom: 15 },
  modalIngredient: { fontSize: 15, color: '#444', marginBottom: 8, lineHeight: 22 },
  recipeInfoRow: { flexDirection: 'row', gap: 15 },
  infoBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 5 },
  infoBadgeText: { fontSize: 13, fontWeight: '600', color: '#666' },
  stepRow: { flexDirection: 'row', marginBottom: 20, gap: 15 },
  stepNumberContainer: { width: 28, height: 28, backgroundColor: '#1A1A1A', borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  stepNumberText: { color: 'white', fontSize: 14, fontWeight: '700' },
  stepDescription: { flex: 1, fontSize: 15, color: '#444', lineHeight: 22 }
});