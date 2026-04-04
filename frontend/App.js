import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, Text, View, FlatList, TextInput, 
  TouchableOpacity, SafeAreaView, KeyboardAvoidingView, 
  Platform, ActivityIndicator, Alert, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ingredientService, equipmentService } from './src/services/api';

export default function App() {
  // --- NAVIGATION ---
  const [currentScreen, setCurrentScreen] = useState('pantry'); // 'pantry' ou 'equipment'

  // --- ÉTATS INGRÉDIENTS ---
  const [ingredients, setIngredients] = useState([]);
  const [ingName, setIngName] = useState('');
  const [ingQty, setIngQty] = useState('');
  const [ingUnit, setIngUnit] = useState('pcs');

  // --- ÉTATS ÉQUIPEMENT ---
  const [equipments, setEquipments] = useState([]);
  const [eqName, setEqName] = useState('');

  const [loading, setLoading] = useState(true);

  // --- CHARGEMENT DES DONNÉES ---
  const loadAllData = async () => {
    setLoading(true);
    try {
      const [ingData, eqData] = await Promise.all([
        ingredientService.getAll(),
        equipmentService.getAll()
      ]);
      setIngredients(ingData);
      setEquipments(eqData);
      
      // LOGIQUE NOUVEL UTILISATEUR :
      // Si aucun équipement n'est enregistré, on force la page équipement
      if (eqData.length === 0) {
        setCurrentScreen('equipment');
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAllData(); }, []);

  // --- ACTIONS INGRÉDIENTS ---
  const handleAddIngredient = async () => {
    if (!ingName || !ingQty) return;
    const result = await ingredientService.create({ name: ingName, quantity: parseFloat(ingQty), unit: ingUnit });
    if (result && !result.detail) {
      setIngName(''); setIngQty(''); loadAllData();
    }
  };

  // --- ACTIONS ÉQUIPEMENT ---
  const handleAddEquipment = async () => {
    if (!eqName) return;
    const result = await equipmentService.create(eqName);
    if (result) {
      setEqName('');
      loadAllData();
    }
  };

  const handleToggleEquipment = async (id) => {
    const result = await equipmentService.toggle(id);
    if (result) {
      setEquipments(prev => prev.map(eq => eq.id === id ? { ...eq, is_active: !eq.is_active } : eq));
    }
  };

  // --- RENDU DES ÉCRANS ---

  const renderPantry = () => (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <Text style={styles.title}>My Pantry</Text>
        <Text style={styles.subtitle}>Your ingredients for AI planning</Text>
      </View>

      <FlatList
        data={[
          { title: 'Fresh', data: ingredients.filter(i => !i.is_staple) },
          { title: 'Basics', data: ingredients.filter(i => i.is_staple) }
        ]}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>{item.title}</Text>
            {item.data.map(ing => (
              <View key={ing.id} style={styles.card}>
                <Text style={styles.cardText}>{ing.name} ({ing.quantity} {ing.unit})</Text>
                <TouchableOpacity onPress={() => ingredientService.delete(ing.id).then(loadAllData)}>
                  <Ionicons name="trash-outline" size={20} color="#FF4444" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      />

      <View style={styles.footer}>
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
        <Text style={styles.title}>Equipment</Text>
        <Text style={styles.subtitle}>What tools are in your kitchen?</Text>
      </View>

      <FlatList
        data={equipments}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={[styles.eqCard, !item.is_active && styles.eqCardInactive]} 
            onPress={() => handleToggleEquipment(item.id)}
          >
            <Text style={[styles.eqText, !item.is_active && styles.eqTextInactive]}>{item.name}</Text>
            <Ionicons 
              name={item.is_active ? "checkmark-circle" : "ellipse-outline"} 
              size={24} 
              color={item.is_active ? "#1A1A1A" : "#CCC"} 
            />
          </TouchableOpacity>
        )}
      />

      <View style={styles.footer}>
        <View style={styles.inputContainer}>
          <TextInput style={[styles.input, { flex: 1 }]} placeholder="Ex: Oven, Blender..." value={eqName} onChangeText={setEqName} />
          <TouchableOpacity style={styles.addButton} onPress={handleAddEquipment}>
            <Ionicons name="add" size={24} color="white" />
          </TouchableOpacity>
        </View>
        {equipments.length > 0 && (
          <TouchableOpacity style={styles.doneButton} onPress={() => setCurrentScreen('pantry')}>
            <Text style={styles.doneButtonText}>Go to my Pantry</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        
        {loading ? <ActivityIndicator size="large" color="#000" /> : (
          currentScreen === 'pantry' ? renderPantry() : renderEquipment()
        )}

        {/* PETIT MENU DE NAVIGATION EN BAS (NOTION STYLE) */}
        {currentScreen === 'pantry' && (
          <TouchableOpacity style={styles.navToggle} onPress={() => setCurrentScreen('equipment')}>
            <Ionicons name="settings-outline" size={20} color="#666" />
            <Text style={styles.navToggleText}>Kitchen Settings</Text>
          </TouchableOpacity>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { padding: 25, paddingTop: 10 },
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { fontSize: 14, color: '#AAA' },
  listContent: { paddingHorizontal: 25, paddingBottom: 150 },
  
  // Styles Ingrédients
  sectionContainer: { marginBottom: 20 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#CCC', textTransform: 'uppercase', marginBottom: 10 },
  card: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#EEE' },
  cardText: { fontSize: 16, color: '#333' },

  // Styles Équipements
  eqCard: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, backgroundColor: '#F9F9F9', borderRadius: 12, marginBottom: 10 },
  eqCardInactive: { opacity: 0.5, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#EEE' },
  eqText: { fontSize: 16, fontWeight: '600' },
  eqTextInactive: { color: '#AAA', textDecorationLine: 'line-through' },

  footer: { position: 'absolute', bottom: 0, width: '100%', padding: 20, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#F5F5F5' },
  inputContainer: { flexDirection: 'row', gap: 10 },
  input: { backgroundColor: '#F5F5F5', padding: 12, borderRadius: 10 },
  addButton: { backgroundColor: '#1A1A1A', width: 50, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  
  doneButton: { backgroundColor: '#F0F9F0', padding: 15, borderRadius: 10, marginTop: 10, alignItems: 'center' },
  doneButtonText: { color: '#2D5A27', fontWeight: '700' },

  navToggle: { position: 'absolute', top: 30, right: 20, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F5F5F5', padding: 8, borderRadius: 20 },
  navToggleText: { fontSize: 12, color: '#666', fontWeight: '600' }
});