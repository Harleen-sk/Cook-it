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
import { translations } from './src/utils/translations';

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

  const [selectedIngredients, setSelectedIngredients] = useState([]);
  const [selectedEquipments, setSelectedEquipments] = useState([]);

  const [selectedMealType, setSelectedMealType] = useState('lunch');
  const [language, setLanguage] = useState('en');

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

  // --- LOGIQUE TRADUCTION ---
  const t = (key) => {
    const keys = key.split('.');
    let result = translations[language];
    keys.forEach(k => { result = result ? result[k] : null; });
    return result || key;
  };

  // --- LOGIQUE ACTIONS ---
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

  const handleGenerateRecipes = async (selectedIngs, selectedEqs) => {
    setLoading(true);
    try {
      const selection = {
        ingredients: selectedIngs,
        equipment: selectedEqs,
        meal_type: selectedMealType,
        lang: language
      };

      const data = await aiService.getSuggestions(selection);
      setSuggestions(data.suggestions);
      setCurrentScreen('suggestions');
    } catch (e) {
      Alert.alert("Erreur", "L'IA n'a pas pu mijoter vos idées.");
    } finally {
      setLoading(false);
    }
  };
// Récupérer les détails d'une recette
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

  const handleDeleteFavorite = async (id) => {
    console.log("Tentative de suppression de l'ID:", id);
    try {
      await aiService.deleteFavorite(id);
      setFavorites(prev => prev.filter(fav => fav.id !== id));
    } catch (e) {
      console.error("Détail erreur suppression:", e);
      Alert.alert("Erreur", "Impossible de supprimer ce favori.");
    }
  };

  const openSelectionScreen = () => {
    setSelectedIngredients(ingredients.map(i => i.name));
    setSelectedEquipments(equipments.filter(e => e.is_active).map(e => e.name));
    setCurrentScreen('selection');
  };

  const handleFinishCooking = async () => {
    Alert.alert(
      t('Recette terminée ? 👨‍🍳'),
      t('Voulez-vous déduire ces ingrédients de votre réserve ?'),
      [
        { text: t('backBtn'), style: "cancel" },
        { 
          text: "Oui", 
          onPress: async () => {
            try {
              const updateData = { used_ingredients: selectedRecipe.used_ingredients_list };
              await aiService.consumeIngredients(updateData);
              setModalVisible(false);
              loadAllData();
              Alert.alert("Succès", "Réserve mise à jour !");
            } catch (e) {
              Alert.alert("Erreur", "Échec de la mise à jour.");
            }
          } 
        }
      ]
    );
  };

  // --- RENDUS D'ÉCRANS ---

  const renderPantry = () => (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{t('pantryTitle')}</Text>
          <View style={{flexDirection: 'row', gap: 10}}>
            <TouchableOpacity 
              style={styles.settingsBtn} 
              onPress={() => { loadFavorites(); setCurrentScreen('favorites'); }}
            >
              <Ionicons name="heart" size={22} color="#FF4444" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.settingsBtn} 
              onPress={() => setLanguage(language === 'en' ? 'fr' : 'en')}
            >
              <Text style={{fontWeight: 'bold'}}>{language.toUpperCase()}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingsBtn} onPress={() => setCurrentScreen('equipment')}>
              <Ionicons name="cog-outline" size={22} color="#666" />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.subtitle}>{t('pantrySubtitle')}</Text>
      </View>

      <FlatList
        data={[
          { title: t('freshTitle'), data: ingredients.filter(i => !i.is_staple) },
          { title: t('stapleTitle'), data: ingredients.filter(i => i.is_staple) }
        ]}
        contentContainerStyle={styles.listContent}
        keyExtractor={(item) => item.title}
        renderItem={({ item }) => (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>{item.title}</Text>
            {item.data.length === 0 ? <Text style={styles.emptyText}>{t('empty')}</Text> : 
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
      <TouchableOpacity style={styles.generateFab} onPress={openSelectionScreen}>
        <Text style={styles.generateFabText}>{t('generateBtn')}</Text>
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
          <TextInput style={[styles.input, { flex: 2 }]} placeholder={t('addIngPlaceholder')} value={ingName} onChangeText={setIngName} />
          <TextInput style={[styles.input, { flex: 1 }]} placeholder={t('qtyPlaceholder')} keyboardType="numeric" value={ingQty} onChangeText={setIngQty} />
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
        <Text style={styles.title}>{t('toolsTitle')}</Text>
        <Text style={styles.subtitle}>{t('toolsSubtitle')}</Text>
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
          <TextInput style={[styles.input, { flex: 1 }]} placeholder={t('addTool')} value={eqName} onChangeText={setEqName} />
          <TouchableOpacity style={styles.addButton} onPress={handleAddEquipment}>
            <Ionicons name="add" size={24} color="white" />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.doneBtn} onPress={() => setCurrentScreen('pantry')}>
          <Text style={styles.doneBtnText}>{t('GoPantry')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFavorites = () => (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <Text style={styles.title}>❤️ {t('favoritesTitle')}</Text>
        <Text style={styles.subtitle}>{t('favoritesSubtitle')}</Text>
      </View>
      <FlatList
        data={favorites}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.recipeCard}>
            <View style={styles.recipeHeader}>
              <Text style={styles.recipeTitle}>{item.title}</Text>
              <TouchableOpacity onPress={() => handleDeleteFavorite(item.id)}>
                <Ionicons name="trash" size={22} color="#FF4444" />
              </TouchableOpacity>
            </View>
            <Text style={styles.recipeDesc} numberOfLines={2}>
              {item.details.ingredients.length} ingrédients • {item.details.prep_time}
            </Text>
            <TouchableOpacity 
              style={styles.recipeBtn} 
              onPress={() => { setSelectedRecipe(item.details); setModalVisible(true); }}
            >
              <Text style={styles.recipeBtnText}>{t('ViewRecipe')}</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>{t('Nofavorites')}</Text>}
      />
      <TouchableOpacity style={styles.backFab} onPress={() => setCurrentScreen('pantry')}>
        <Ionicons name="arrow-back" size={20} color="white" />
        <Text style={{color: 'white', fontWeight: '700', marginLeft: 8}}>{t('backBtn')}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderSuggestions = () => (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('AISuggestions')}</Text>
        <Text style={styles.subtitle}>{t('RecipesMatchingInventory')}</Text>
      </View>
      <FlatList
        data={suggestions}
        keyExtractor={(item, index) => item?.id ? item.id.toString() : index.toString()}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.recipeCard}>
            <View style={styles.recipeHeader}>
              <Text style={styles.recipeTitle}>{item?.title || t('RecipeWithoutName')}</Text>
              <Text style={styles.recipeScore}>{item?.score || "N/A"}</Text>
            </View>
            <Text style={styles.recipeDesc}>{item?.description || t('NoDescription')}</Text>
            <TouchableOpacity 
              style={styles.recipeBtn} 
              onPress={() => handleViewRecipe(item?.title)}
            >
              <Text style={styles.recipeBtnText}>{t('LetsGetStarted')}</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>{t('NoSuggestionsFound')}</Text>}
      />
      <TouchableOpacity style={styles.backFab} onPress={() => setCurrentScreen('pantry')}>
        <Ionicons name="arrow-back" size={20} color="white" />
        <Text style={{color: 'white', fontWeight: '700', marginLeft: 8}}>{t('backBtn')}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderSelection = () => (
    <View style={{ flex: 1, backgroundColor: '#FFF' }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setCurrentScreen('pantry')} style={{marginBottom: 10}}>
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('MySelection')}</Text>
        <Text style={styles.subtitle}>{t('CustomizeBeforeCooking')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.miniTitle}>{t('TimeDay')}</Text>
        <View style={styles.chipContainer}>
          {['breakfast', 'lunch', 'snack', 'dinner'].map(type => (
            <TouchableOpacity 
              key={type} 
              style={[styles.chip, selectedMealType === type && styles.chipActive]}
              onPress={() => setSelectedMealType(type)}
            >
              <Text style={[styles.chipText, selectedMealType === type && styles.chipTextActive]}>{t(type)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.miniTitle}>{t('addIngPlaceholder')} ({selectedIngredients.length})</Text>
        <View style={styles.chipContainer}>
          {ingredients.map(ing => (
            <TouchableOpacity 
              key={ing.id} 
              style={[styles.chip, selectedIngredients.includes(ing.name) && styles.chipActive]}
              onPress={() => {
                setSelectedIngredients(prev => 
                  prev.includes(ing.name) ? prev.filter(i => i !== ing.name) : [...prev, ing.name]
                );
              }}
            >
              <Text style={[styles.chipText, selectedIngredients.includes(ing.name) && styles.chipTextActive]}>{ing.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.miniTitle}>{t('Equipment')} ({selectedEquipments.length})</Text>
        <View style={styles.chipContainer}>
          {equipments.filter(e => e.is_active).map(eq => (
            <TouchableOpacity 
              key={eq.id} 
              style={[styles.chip, selectedEquipments.includes(eq.name) && styles.chipActive]}
              onPress={() => {
                setSelectedEquipments(prev => 
                  prev.includes(eq.name) ? prev.filter(e => e !== eq.name) : [...prev, eq.name]
                );
              }}
            >
              <Text style={[styles.chipText, selectedEquipments.includes(eq.name) && styles.chipTextActive]}>{eq.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.footerSelection}>
        <TouchableOpacity 
          style={styles.launchBtn} 
          onPress={() => handleGenerateRecipes(selectedIngredients, selectedEquipments)}
        >
          <Text style={styles.launchBtnText}>{t('launchChef')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#1A1A1A" />
            <Text style={styles.loadingText}>{t('CookingBtn')}</Text>
          </View>
        ) : (
          currentScreen === 'pantry' ? renderPantry() : 
          currentScreen === 'equipment' ? renderEquipment() :
          currentScreen === 'favorites' ? renderFavorites() :
          currentScreen === 'suggestions' ? renderSuggestions() : 
          renderSelection()
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
                <Text style={styles.loadingText}>{t('WriteRecipe')}</Text>
              </View>
            ) : selectedRecipe && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeader}>
                   <Text style={styles.modalTitle}>{selectedRecipe.title}</Text>
                   <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
                      <TouchableOpacity onPress={handleSaveFavorite}>
                        <Ionicons name="heart-outline" size={28} color="#FF4444" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setModalVisible(false)}>
                        <Ionicons name="close-circle" size={30} color="#DDD" />
                      </TouchableOpacity>
                    </View>
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

                <Text style={styles.modalSectionTitle}>{"Ingredients"}</Text>
                  {selectedRecipe.ingredients.map((ing, idx) => (
                  <Text key={idx} style={styles.modalIngredient}>• {ing}</Text>
                ))}

                <Text style={styles.modalSectionTitle}>{t('Instructions')}</Text>
                {selectedRecipe.instructions.map((step, idx) => (
                  <View key={idx} style={styles.stepRow}>
                    <View style={styles.stepNumberContainer}>
                      <Text style={styles.stepNumberText}>{idx + 1}</Text>
                    </View>
                    <Text style={styles.stepDescription}>{step}</Text>
                  </View>
                ))}

                <View style={{height: 50}} />
                <TouchableOpacity style={styles.finishRecipeBtn} onPress={handleFinishCooking}>
                  <Ionicons name="restaurant-outline" size={20} color="white" />
                  <Text style={styles.finishRecipeBtnText}>{t('FinishCook')}</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 25, paddingTop: 10 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: '#AAA', marginTop: 4 },
  settingsBtn: { backgroundColor: '#F5F5F5', padding: 8, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
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
  modalContent: { flex: 1, padding: 25, backgroundColor: 'white' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  modalTitle: { fontSize: 24, fontWeight: '800', width: '80%' },
  modalSectionTitle: { fontSize: 18, fontWeight: '700', marginTop: 25, marginBottom: 15 },
  modalIngredient: { fontSize: 15, color: '#444', marginBottom: 8, lineHeight: 22 },
  recipeInfoRow: { flexDirection: 'row', gap: 15 },
  infoBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 5 },
  infoBadgeText: { fontSize: 13, fontWeight: '600', color: '#666' },
  miniTitle: { fontSize: 16, fontWeight: '700', marginTop: 20, marginBottom: 10 },
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F5F5F5', borderWidth: 1, borderColor: '#EEE' },
  chipActive: { backgroundColor: '#1A1A1A', borderColor: '#1A1A1A' },
  chipText: { fontSize: 13, color: '#666' },
  chipTextActive: { color: '#FFF', fontWeight: '600' },
  footerSelection: { padding: 20, borderTopWidth: 1, borderTopColor: '#EEE' },
  launchBtn: { backgroundColor: '#1A1A1A', padding: 18, borderRadius: 15, alignItems: 'center' },
  launchBtnText: { color: 'white', fontSize: 16, fontWeight: '700' },
  finishRecipeBtn: { backgroundColor: '#4CAF50', padding: 15, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  finishRecipeBtnText: { color: 'white', fontWeight: '700', fontSize: 16 },
  stepRow: { flexDirection: 'row', marginBottom: 15, gap: 12 },
  stepNumberContainer: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#1A1A1A', justifyContent: 'center', alignItems: 'center' },
  stepNumberText: { color: 'white', fontSize: 14, fontWeight: '700' },
  stepDescription: { flex: 1, fontSize: 15, lineHeight: 22, color: '#333' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  selectionCard: { backgroundColor: 'white', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, minHeight: height * 0.7 },
  miniTitle: { fontSize: 14, fontWeight: '700', color: '#CCC', textTransform: 'uppercase', marginVertical: 15 },
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F0F0F0', borderWidth: 1, borderColor: '#EEE' },
  chipActive: { backgroundColor: '#1A1A1A', borderColor: '#1A1A1A' },
  chipText: { color: '#666', fontWeight: '600' },
  chipTextActive: { color: '#FFF' },
  launchBtn: { backgroundColor: '#1A1A1A', padding: 18, borderRadius: 15, marginTop: 30, alignItems: 'center' },
  launchBtnText: { color: 'white', fontWeight: '800', fontSize: 16 },

  sectionContainer: {
    marginBottom: 20,
    padding: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#2d3436',
  },
  mealTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  mealChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#dfe6e9',
    backgroundColor: '#fff',
    marginBottom: 8,
    minWidth: '48%', // Pour avoir 2 colonnes propres
    alignItems: 'center',
  },
  mealChipSelected: {
    backgroundColor: '#00b894',
    borderColor: '#00b894',
  },
  mealText: {
    color: '#636e72',
    fontWeight: '600',
  },
  mealTextSelected: {
    color: '#fff',
  },
  footerSelection: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
  },
  launchBtn: {
    backgroundColor: '#1A1A1A',
    padding: 18,
    borderRadius: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5
  },
  launchBtnText: { color: 'white', fontSize: 18, fontWeight: '800' },
  chip: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#EEE'
  },
  chipActive: { backgroundColor: '#1A1A1A', borderColor: '#1A1A1A' },
  chipText: { color: '#666', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#FFF' },

  finishRecipeBtn: {
    backgroundColor: '#00b894', // Un vert "succès"
    flexDirection: 'row',
    padding: 18,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
    marginHorizontal: 10,
    gap: 10,
    elevation: 3
  },
  finishRecipeBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '800'
  },
});