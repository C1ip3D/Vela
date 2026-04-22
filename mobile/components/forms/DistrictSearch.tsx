import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  ActivityIndicator,
  Modal,
} from "react-native";
import { Search, MapPin } from "lucide-react-native";
import { api } from "@/lib/api";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY",
];

export interface District {
  district_name: string;
  district_baseurl: string;
  district_app_name: string;
}

interface DistrictSearchProps {
  onSelect: (district: District) => void;
  selectedDistrict: District | null;
  onClear: () => void;
  compact?: boolean;
}

export function DistrictSearch({
  onSelect,
  selectedDistrict,
  onClear,
  compact = false,
}: DistrictSearchProps) {
  const [icStateCode, setIcStateCode] = useState("CA");
  const [showStatePicker, setShowStatePicker] = useState(false);
  const [districtQuery, setDistrictQuery] = useState(
    selectedDistrict?.district_name ?? ""
  );
  const [districts, setDistricts] = useState<District[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!districtQuery || districtQuery.length < 3 || selectedDistrict) {
      setDistricts([]);
      setShowDropdown(false);
      return;
    }
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await api.get(
          `/api/ic/districts?query=${encodeURIComponent(districtQuery)}&state=${icStateCode}`
        );
        setDistricts(res.data?.data || []);
        setShowDropdown(true);
      } catch {
        // silent
      } finally {
        setIsSearching(false);
      }
    }, 400);
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [districtQuery, icStateCode, selectedDistrict]);

  const stateWidth = compact ? 72 : 88;
  const labelClass = compact
    ? "text-xs text-star-faint mb-1"
    : "text-xs text-star-dim uppercase tracking-wider mb-1.5";

  return (
    <>
      <View className="flex-row gap-3">
        {/* State picker */}
        <View style={{ width: stateWidth }}>
          <Text className={labelClass}>State</Text>
          <TouchableOpacity
            onPress={() => setShowStatePicker(true)}
            className="flex-row items-center justify-between border border-space-border rounded-xl bg-space-mid/60 px-3 py-3"
            style={{ minHeight: 46 }}
          >
            <Text className="text-lg text-star-bright">{icStateCode}</Text>
            <MapPin size={12} color="#4A5578" />
          </TouchableOpacity>
        </View>

        {/* District search */}
        <View className="flex-1">
          <Text className={labelClass}>District</Text>
          <View
            className="flex-row items-center border border-space-border rounded-xl bg-space-mid/60 px-3"
            style={{ minHeight: 46 }}
          >
            <Search size={14} color="#4A5578" />
            <TextInput
              value={districtQuery}
              onChangeText={(t) => {
                setDistrictQuery(t);
                if (selectedDistrict) onClear();
              }}
              placeholder="Search district..."
              placeholderTextColor="#4A5578"
              className="flex-1 py-3 px-2 text-lg text-star-bright"
            />
            {isSearching && <ActivityIndicator size="small" color="#4A5578" />}
          </View>

          {showDropdown && districts.length > 0 && !selectedDistrict && (
            <ScrollView
              className="border border-space-border rounded-xl bg-space-mid mt-1.5 overflow-hidden"
              style={{ maxHeight: 280 }}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >
              {districts.map((item, i) => (
                <TouchableOpacity
                  key={i.toString()}
                  onPress={() => {
                    onSelect(item);
                    setDistrictQuery(item.district_name);
                    setShowDropdown(false);
                  }}
                  className="px-4 py-3.5 border-b border-space-border/50"
                >
                  <Text className="text-base text-star-bright" numberOfLines={1}>
                    {item.district_name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </View>

      {/* State Picker Modal */}
      <Modal visible={showStatePicker} transparent animationType="slide">
        <TouchableOpacity
          className="flex-1 bg-black/60"
          onPress={() => setShowStatePicker(false)}
        />
        <View className="bg-space-mid border-t border-space-border" style={{ maxHeight: 320 }}>
          <FlatList
            data={US_STATES}
            keyExtractor={(s) => s}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => {
                  setIcStateCode(item);
                  onClear();
                  setShowStatePicker(false);
                }}
                className="px-6 py-4 border-b border-space-border/50"
              >
                <Text
                  className={`text-sm ${item === icStateCode ? "text-vela-300 font-semibold" : "text-star-white"}`}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </>
  );
}
