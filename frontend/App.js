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

  // --- ÉTATS APERÇU / SÉLECTION DE L'AGENT ---
  const [agentPreviewData, setAgentPreviewData] = useState(null);
  const [selectedPreviewIngredients, setSelectedPreviewIngredients] = useState([]);
  const [selectedPreviewStaples, setSelectedPreviewStaples] = useState([]);
  const [loadingAgent, setLoadingAgent] = useState(false); // Nouvel état pour le chargement de l'agent
  const [isConfirming, setIsConfirming] = useState(false);   // Nouvel état pour la confirmation silencieuse

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

  // --- AJOUT INGRÉDIENT AVEC AUTORISATION ---
  const handleAddIngredient = async () => {
    if (!ingName || !ingQty) return;

    Alert.alert(
      "Confirm Addition",
      `Do you want to add ${ingQty} ${ingUnit} of "${ingName}" to your pantry?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Add",
          style: "default",
          onPress: async () => {
            const result = await ingredientService.create({ 
              name: ingName, quantity: parseFloat(ingQty), unit: ingUnit 
            });
            if (result && !result.detail) {
              setIngName(''); setIngQty(''); setIngUnit('pcs');
              loadAllData();
            }
          }
        }
      ]
    );
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
      Alert.alert("Success!", "The recipe has been added to your favorites ❤️");
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
    try {
      await aiService.deleteFavorite(id);
      setFavorites(prev => prev.filter(fav => fav.id !== id));
    } catch (e) {
      Alert.alert("Erreur", "Impossible de supprimer ce favori.");
    }
  };

  const openSelectionScreen = () => {
    const availablePantry = ingredients.filter(i => !i.is_in_shopping_list);
    setSelectedIngredients(availablePantry.map(i => i.name));
    setSelectedEquipments(equipments.filter(e => e.is_active).map(e => e.name));
    setCurrentScreen('selection');
  };

  // --- TRANSITION FLUIDE ET INSTANTANÉE VERS L'ÉCRAN DE L'AGENT ---
  const handleFinishCooking = async () => {
    setModalVisible(false);          // On ferme immédiatement la recette 
    setCurrentScreen('agentPreview'); // On bascule directement sur l'écran de l'agent
    setLoadingAgent(true);            // On lance le chargement local interne à l'écran agent
    setAgentPreviewData(null);        // On nettoie les anciennes données au cas où
    
    try {
      const recipeTitle = selectedRecipe.title || "Recette inconnue";
      const recipeIngredients = selectedRecipe.ingredients || []; 
      
      const previewResult = await aiService.executeAgentPantryPreview(recipeTitle, recipeIngredients);
      
      if (!previewResult || !previewResult.ingredients_to_consume) {
        throw new Error("Données de l'agent corrompues ou indisponibles");
      }

      setAgentPreviewData(previewResult);
      setSelectedPreviewIngredients(previewResult.ingredients_to_consume || []);
      setSelectedPreviewStaples(previewResult.staples_to_buy || []);
    } catch (e) {
      console.error("Erreur preview agent :", e);
      Alert.alert("Erreur", "L'Agent n'a pas pu analyser la recette.");
      setCurrentScreen('pantry'); // Retour sécurisé au garde-manger en cas d'erreur
    } finally {
      setLoadingAgent(false);
    }
  };

  // --- CONFIRMATION ET RETOUR NET EN ARRIÈRE-PLAN (SANS FLASH COOKINGBTN) ---
  const handleConfirmAgentPantry = async () => {
    setIsConfirming(true); // Active l'indicateur discret sur le bouton de validation
    try {
      // Soumission des modifications à l'API
      await aiService.executeAgentPantryConfirm(selectedPreviewIngredients, selectedPreviewStaples);
      
      // Récupération "silencieuse" des données mises à jour sans déclencher le loader global global complet
      const [ingData, eqData] = await Promise.all([
        ingredientService.getAll(),
        equipmentService.getAll()
      ]);
      setIngredients(ingData);
      setEquipments(eqData);

      setCurrentScreen('pantry'); // Redirection instantanée et propre
    } catch (e) {
      console.error("Erreur confirmation agent :", e);
      Alert.alert("Erreur", "Impossible d'appliquer les modifications.");
    } finally {
      setIsConfirming(false);
    }
  };

  // --- VUE INTERACTIVE DU RAPPORT DE L'AGENT IA ---
  const renderAgentPreview = () => {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFF' }}>
        <View style={styles.header}>
          <Text style={styles.title}>🤖 Rapport de l'Agent</Text>
          <Text style={styles.subtitle}>Validez ou ajustez les stocks consommés avant de mettre à jour</Text>
        </View>

        {loadingAgent ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#00b894" />
            <Text style={[styles.loadingText, { color: '#00b894', marginTop: 15 }]}>
              L'Agent fait le tri dans vos placards... 🍳
            </Text>
          </View>
        ) : !agentPreviewData ? (
          <View style={styles.centered}>
            <Text style={styles.emptyText}>Aucune donnée disponible.</Text>
          </View>
        ) : (
          <>
            <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
              <View style={{ backgroundColor: '#F5F6FA', padding: 15, borderRadius: 12, marginBottom: 20 }}>
                <Text style={{ fontSize: 15, color: '#2f3640', fontStyle: 'italic', lineHeight: 22 }}>
                  "{agentPreviewData.assistant_message || 'Analyse terminée.'}"
                </Text>
              </View>

              <Text style={styles.miniTitle}>📉 Ingrédients à déduire de vos stocks :</Text>
              {/* CORRECTION ICI : On vérifie si le tableau est inexistant OU vide */}
              {!agentPreviewData.ingredients_to_consume || agentPreviewData.ingredients_to_consume.length === 0 ? (
                <Text style={styles.emptyText}>Aucun ingrédient à retirer.</Text>
              ) : (
                agentPreviewData.ingredients_to_consume.map((item, index) => {
                  const isSelected = selectedPreviewIngredients.some(i => i.name === item.name);
                  return (
                    <View key={index} style={[styles.card, { opacity: isSelected ? 1 : 0.4 }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.cardMainText, !isSelected && { textDecorationLine: 'line-through', color: '#AAA' }]}>
                          {item.name}
                        </Text>
                        <Text style={styles.cardSubText}>Quantité estimée : -{item.amount}</Text>
                      </View>
                      <TouchableOpacity 
                        style={{
                          backgroundColor: isSelected ? '#FF4444' : '#00b894',
                          paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8
                        }}
                        onPress={() => {
                          if (isSelected) {
                            setSelectedPreviewIngredients(prev => prev.filter(i => i.name !== item.name));
                          } else {
                            setSelectedPreviewIngredients(prev => [...prev, item]);
                          }
                        }}
                      >
                        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 12 }}>
                          {isSelected ? "Annuler" : "Retirer"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}

              <Text style={[styles.miniTitle, { marginTop: 25 }]}>🛒 À ajouter à la liste de courses (Staples épuisés) :</Text>
              {/* CORRECTION ICI : Même sécurité pour les staples */}
              {!agentPreviewData.staples_to_buy || agentPreviewData.staples_to_buy.length === 0 ? (
                <Text style={styles.emptyText}>Aucun condiment de base à racheter.</Text>
              ) : (
                agentPreviewData.staples_to_buy.map((item, index) => {
                  const isSelected = selectedPreviewStaples.some(s => s.name === item.name);
                  return (
                    <View key={index} style={[styles.card, { opacity: isSelected ? 1 : 0.4 }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.cardMainText, !isSelected && { textDecorationLine: 'line-through', color: '#AAA' }]}>
                          {item.name}
                        </Text>
                      </View>
                      <TouchableOpacity 
                        style={{
                          backgroundColor: isSelected ? '#FF4444' : '#00b894',
                          paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8
                        }}
                        onPress={() => {
                          if (isSelected) {
                            setSelectedPreviewStaples(prev => prev.filter(s => s.name !== item.name));
                          } else {
                            setSelectedPreviewStaples(prev => [...prev, item]);
                          }
                        }}
                      >
                        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 12 }}>
                          {isSelected ? "Ne pas ajouter" : "Ajouter"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
              <View style={{ height: 100 }} />
            </ScrollView>

            <View style={styles.footerSelection}>
              <TouchableOpacity 
                style={[styles.launchBtn, { backgroundColor: '#00b894' }]} 
                onPress={handleConfirmAgentPantry}
                disabled={isConfirming}
              >
                {isConfirming ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.launchBtnText}>Confirmer et Terminer 🎉</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    );
  };

  // --- GARDE-MANGER (PANTRY) FILTRÉ ---
  const renderPantry = () => {
    const activePantryIngredients = ingredients.filter(i => !i.is_in_shopping_list);

    return (
      <View style={{ flex: 1 }}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>{t('pantryTitle')}</Text>
            <View style={{flexDirection: 'row', gap: 10}}>
              <TouchableOpacity style={styles.settingsBtn} onPress={() => setCurrentScreen('shopping')}>
                <Ionicons name="cart" size={22} color="#00b894" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.settingsBtn} onPress={() => { loadFavorites(); setCurrentScreen('favorites'); }}>
                <Ionicons name="heart" size={22} color="#FF4444" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.settingsBtn} onPress={() => setLanguage(language === 'en' ? 'fr' : 'en')}>
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
            { title: t('freshTitle'), data: activePantryIngredients.filter(i => !i.is_staple) },
            { title: t('stapleTitle'), data: activePantryIngredients.filter(i => i.is_staple) }
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
        <TouchableOpacity style={styles.generateFab} onPress={openSelectionScreen}>
          <Ionicons name="bulb-outline" size={20} color="white" style={{marginRight: 8}} />
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
              <Ionicons name="add" size={28} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

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
          <TouchableOpacity style={[styles.eqCard, !item.is_active && styles.eqCardInactive]} onPress={() => handleToggleEquipment(item.id)}>
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
              {item.details?.ingredients?.length || 0} ingrédients • {item.details?.prep_time || ''}
            </Text>
            <TouchableOpacity style={styles.recipeBtn} onPress={() => { setSelectedRecipe(item.details); setModalVisible(true); }}>
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
            <TouchableOpacity style={styles.recipeBtn} onPress={() => handleViewRecipe(item?.title)}>
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

  const renderSelection = () => {
    const availablePantry = ingredients.filter(i => !i.is_in_shopping_list);
    return (
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
              <TouchableOpacity key={type} style={[styles.chip, selectedMealType === type && styles.chipActive]} onPress={() => setSelectedMealType(type)}>
                <Text style={[styles.chipText, selectedMealType === type && styles.chipTextActive]}>{t(type)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.miniTitle}>{t('addIngPlaceholder')} ({selectedIngredients.length})</Text>
          <View style={styles.chipContainer}>
            {availablePantry.map(ing => (
              <TouchableOpacity key={ing.id} style={[styles.chip, selectedIngredients.includes(ing.name) && styles.chipActive]} onPress={() => setSelectedIngredients(prev => prev.includes(ing.name) ? prev.filter(i => i !== ing.name) : [...prev, ing.name])}>
                <Text style={[styles.chipText, selectedIngredients.includes(ing.name) && styles.chipTextActive]}>{ing.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.miniTitle}>{t('Equipment')} ({selectedEquipments.length})</Text>
          <View style={styles.chipContainer}>
            {equipments.filter(e => e.is_active).map(eq => (
              <TouchableOpacity key={eq.id} style={[styles.chip, selectedEquipments.includes(eq.name) && styles.chipActive]} onPress={() => setSelectedEquipments(prev => prev.includes(eq.name) ? prev.filter(e => e !== eq.name) : [...prev, eq.name])}>
                <Text style={[styles.chipText, selectedEquipments.includes(eq.name) && styles.chipTextActive]}>{eq.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ height: 100 }} />
        </ScrollView>

        <View style={styles.footerSelection}>
          <TouchableOpacity style={styles.launchBtn} onPress={() => handleGenerateRecipes(selectedIngredients, selectedEquipments)}>
            <Text style={styles.launchBtnText}>{t('launchChef')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderShoppingList = () => {
    const shoppingItems = ingredients.filter(i => i.is_in_shopping_list);
    return (
      <View style={{ flex: 1 }}>
        <View style={styles.header}>
          <Text style={styles.title}>🛒 {t('shoppingTitle')}</Text>
          <Text style={styles.subtitle}>{t('shoppingSubtitle')}</Text>
        </View>
        <FlatList
          data={shoppingItems}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View>
                <Text style={styles.cardMainText}>{item.name}</Text>
                <Text style={styles.cardSubText}>{item.quantity} {item.unit}</Text>
              </View>
              <TouchableOpacity style={{ backgroundColor: '#00b894', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8 }} onPress={async () => { await ingredientService.markAsBought(item.id); loadAllData(); }}>
                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 13 }}>{t('boughtBtn')}</Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>{t('emptyShopping')}</Text>}
        />
        <TouchableOpacity style={styles.backFab} onPress={() => setCurrentScreen('pantry')}>
          <Ionicons name="arrow-back" size={20} color="white" />
          <Text style={{ color: 'white', fontWeight: '700', marginLeft: 8 }}>{t('backBtn')}</Text>
        </TouchableOpacity>
      </View>
    );
  };

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
          currentScreen === 'shopping' ? renderShoppingList() :
          currentScreen === 'agentPreview' ? renderAgentPreview() : 
          renderSelection()
        )}

        <Modal animationType="slide" visible={modalVisible} presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
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
                {selectedRecipe.ingredients?.map((ing, idx) => (
                  <Text key={idx} style={styles.modalIngredient}>• {ing}</Text>
                ))}

                <Text style={styles.modalSectionTitle}>{t('Instructions')}</Text>
                {selectedRecipe.instructions?.map((step, idx) => (
                  <View key={idx} style={styles.stepRow}>
                    <View style={styles.stepNumberContainer}><Text style={styles.stepNumberText}>{idx + 1}</Text></View>
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
  container: { flex: 1, backgroundColor: '#FFFFFF', paddingTop: Platform.OS === 'android' ? 30 : 0 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 25, paddingTop: 10, paddingBottom: 15, backgroundColor: '#FFF' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: '#AAA', marginTop: 4 },
  miniTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A1A', marginTop: 15, marginBottom: 10 },
  settingsBtn: { backgroundColor: '#F5F5F5', padding: 8, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: 25, paddingBottom: 220 },
  sectionContainer: { marginBottom: 25 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#CCC', textTransform: 'uppercase', marginBottom: 10, letterSpacing: 1 },
  card: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 0.5, borderBottomColor: '#F0F0F0' },
  cardMainText: { fontSize: 16, fontWeight: '600', textTransform: 'capitalize' },
  cardSubText: { fontSize: 12, color: '#999', marginTop: 2 },
  emptyText: { fontSize: 14, color: '#BBB', textAlign: 'center', marginVertical: 10 },
  generateFab: { position: 'absolute', bottom: 120, right: 25, backgroundColor: '#1A1A1A', flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 14, borderRadius: 30, alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8 },
  generateFabText: { color: 'white', fontWeight: '700', fontSize: 15 },
  backFab: { position: 'absolute', bottom: 30, left: 25, backgroundColor: '#1A1A1A', flexDirection: 'row', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 25, alignItems: 'center' },
  footer: { position: 'absolute', bottom: 0, width: '100%', padding: 20, backgroundColor: '#FFF' },
  inputContainer: { flexDirection: 'row', gap: 10 },
  input: { backgroundColor: '#F5F5F5', borderRadius: 12, padding: 15, fontSize: 15 },
  addButton: { backgroundColor: '#1A1A1A', borderRadius: 12, padding: 12, justifyContent: 'center', alignItems: 'center' },
  unitSelector: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  unitBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#F5F5F5' },
  unitBadgeActive: { backgroundColor: '#1A1A1A' },
  unitText: { color: '#666', fontSize: 13, fontWeight: '600' },
  unitTextActive: { color: '#FFF' },
  eqCard: { flexDirection: 'row', justifyContent: 'space-between', padding: 18, backgroundColor: '#F9F9F9', borderRadius: 14, marginBottom: 12 },
  eqCardInactive: { opacity: 0.4, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#EEE' },
  eqText: { fontSize: 16, fontWeight: '600' },
  eqTextInactive: { color: '#AAA', textDecorationLine: 'line-through' },
  doneBtn: { backgroundColor: '#1A1A1A', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  doneBtnText: { color: 'white', fontWeight: '700' },
  recipeCard: { backgroundColor: '#F9F9F9', padding: 20, borderRadius: 16, marginBottom: 15 },
  recipeHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  recipeTitle: { fontSize: 18, fontWeight: '700', flex: 1 },
  recipeScore: { fontSize: 14, fontWeight: '700', color: '#00b894' },
  recipeDesc: { fontSize: 14, color: '#666', marginBottom: 12 },
  recipeBtn: { backgroundColor: '#1A1A1A', padding: 12, borderRadius: 10, alignItems: 'center' },
  recipeBtnText: { color: 'white', fontWeight: '600' },
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 5 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F5F5F5', borderWidth: 1, borderColor: '#EEE' },
  chipActive: { backgroundColor: '#1A1A1A', borderColor: '#1A1A1A' },
  chipText: { color: '#666', fontWeight: '600' },
  chipTextActive: { color: '#FFF' },
  footerSelection: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#F5F5F5' },
  launchBtn: { backgroundColor: '#1A1A1A', padding: 18, borderRadius: 15, alignItems: 'center' },
  launchBtnText: { color: 'white', fontSize: 16, fontWeight: '800' },
  loadingText: { marginTop: 15, fontSize: 16, fontWeight: 'bold', color: '#1A1A1A' },
  modalContent: { flex: 1, backgroundColor: 'white', padding: 25 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 24, fontWeight: '800', flex: 1 },
  recipeInfoRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  infoBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F5F5F5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  infoBadgeText: { fontSize: 13, color: '#666', fontWeight: '500' },
  modalSectionTitle: { fontSize: 18, fontWeight: '700', marginTop: 20, marginBottom: 10 },
  modalIngredient: { fontSize: 15, color: '#444', marginBottom: 6 },
  stepRow: { flexDirection: 'row', gap: 12, marginBottom: 15, alignItems: 'flex-start' },
  stepNumberContainer: { backgroundColor: '#F5F5F5', width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  stepNumberText: { fontSize: 13, fontWeight: '700' },
  stepDescription: { fontSize: 15, color: '#333', flex: 1, lineHeight: 22 },
  finishRecipeBtn: {
    backgroundColor: '#00b894',
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 30,
    marginHorizontal: 10,
    gap: 10,
    elevation: 3
  },
  finishRecipeBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '800'
  }
});