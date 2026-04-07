import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  SafeAreaView,
} from "react-native";
import { Compass, Send } from "lucide-react-native";
import { useIC } from "@/contexts/InfiniteCampusContext";
import { useAuth } from "@/contexts/AuthContext";
import { useCourses } from "@/hooks/useCourses";
import { api } from "@/lib/api";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export default function AdvisorScreen() {
  const { user } = useAuth();
  const { session } = useIC();
  const { courses } = useCourses();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hi! I'm Kepler, your AI academic advisor. I can help you plan your courses, understand your grades, and explore academic pathways. What would you like to discuss?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await api.post("/api/advisor/chat", {
        message: text,
        studentName: user?.displayName,
        courses: courses.map((c) => ({
          name: c.name,
          grade: c.currentGrade,
          letter: c.letterGrade,
          courseType: c.courseType,
        })),
        icSession: session
          ? {
              authToken: session.authToken,
              baseUrl: session.baseUrl,
              appName: session.appName,
            }
          : null,
      });

      const reply: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: res.data.reply ?? res.data.message ?? "I couldn't generate a response.",
      };
      setMessages((prev) => [...prev, reply]);
    } catch (e: any) {
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  return (
    <SafeAreaView className="flex-1 bg-space-void">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View className="flex-row items-center px-5 pt-4 pb-3 border-b border-space-border">
          <View className="w-9 h-9 rounded-xl bg-vela-400/20 border border-vela-400/30 items-center justify-center mr-3">
            <Compass size={18} color="#818CF8" />
          </View>
          <View>
            <Text className="text-base font-semibold text-star-bright">Kepler</Text>
            <Text className="text-xs text-star-faint">AI Academic Advisor</Text>
          </View>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
          renderItem={({ item: msg }) => (
            <View
              className={`mb-3 max-w-[85%] ${
                msg.role === "user" ? "self-end" : "self-start"
              }`}
            >
              {msg.role === "assistant" && (
                <View className="flex-row items-center gap-1.5 mb-1">
                  <Compass size={11} color="#818CF8" />
                  <Text className="text-[10px] text-vela-400 font-medium">Kepler</Text>
                </View>
              )}
              <View
                className={`rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-vela-400/20 border border-vela-400/30"
                    : "bg-space-elevated border border-space-border"
                }`}
              >
                <Text
                  className={`text-sm leading-5 ${
                    msg.role === "user" ? "text-vela-100" : "text-star-white"
                  }`}
                >
                  {msg.content}
                </Text>
              </View>
            </View>
          )}
          ListFooterComponent={
            loading ? (
              <View className="self-start flex-row items-center gap-2 bg-space-elevated border border-space-border rounded-2xl px-4 py-3 mb-3">
                <ActivityIndicator size="small" color="#818CF8" />
                <Text className="text-sm text-star-faint">Thinking...</Text>
              </View>
            ) : null
          }
        />

        {/* Input */}
        <View className="flex-row items-end gap-2 px-4 pb-4 pt-2 border-t border-space-border">
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask Kepler anything..."
            placeholderTextColor="#4A5578"
            multiline
            maxLength={500}
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: "#1C2A45",
              borderRadius: 16,
              backgroundColor: "#162032",
              paddingHorizontal: 14,
              paddingVertical: 10,
              color: "#E8ECFF",
              fontSize: 14,
              maxHeight: 100,
            }}
            onSubmitEditing={sendMessage}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            onPress={sendMessage}
            disabled={!input.trim() || loading}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: input.trim() && !loading ? "#818CF8" : "#1C2A45",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Send size={16} color={input.trim() && !loading ? "white" : "#4A5578"} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
