import {
  StyleSheet,
  TextInput,
  Text,
  ScrollView,
  View,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
  TouchableOpacity,
} from "react-native";
import React, { useState } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";

import "react-native-polyfill-globals/auto";

export default function App() {
  const [threadID, setThreadID] = useState("");
  const [chat, setChat] = useState("");

  const [streamedChunks, setStreamedChunks] = useState([]);
  const [completeResponse, setCompleteResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const MESSAGE_URL = `${process.env.EXPO_PUBLIC_OPENAI_BASE_URL}/${threadID}/messages`;
  const RUN_URL = `${process.env.EXPO_PUBLIC_OPENAI_BASE_URL}/${threadID}/runs`;
  const THREAD_RUN_URL = `${process.env.EXPO_PUBLIC_OPENAI_BASE_URL}/runs`;

  const ASSISTANT_HEADER = {
    Authorization: `Bearer ${process.env.EXPO_PUBLIC_OPENAI_API_KEY}`,
    "Content-Type": "application/json",
    "OpenAI-Beta": "assistants=v2",
  };

  const aiGetLastMessage = async () => {
    setStreamedChunks([]);
    setCompleteResponse("");

    try {
      const response = await fetch(MESSAGE_URL, {
        method: "GET",
        headers: ASSISTANT_HEADER,
      });
      const results = await response.json();
      setCompleteResponse(results.data[0].content[0].text.value);
    } catch (err) {
      console.error(err);
    }
  };

  const aiCreateRun = async () => {
    setStreamedChunks([]);
    setCompleteResponse("");
    setIsLoading(true);

    try {
      const response = await fetch(RUN_URL, {
        method: "POST",
        headers: ASSISTANT_HEADER,
        body: JSON.stringify({
          assistant_id: process.env.EXPO_PUBLIC_OPENAI_ASSISTANT_ID,
          stream: true,
          additional_messages: [
            {
              role: "user",
              content: chat || "Hi",
            },
          ],
        }),
        reactNative: { textStreaming: true },
      });

      setChat("");
      processStream(response);
    } catch (err) {
      console.error(err);
    }
  };

  const aiCreateThreadRun = async () => {
    setIsLoading(true);

    try {
      const response = await fetch(THREAD_RUN_URL, {
        method: "POST",
        headers: ASSISTANT_HEADER,
        body: JSON.stringify({
          assistant_id: process.env.EXPO_PUBLIC_OPENAI_ASSISTANT_ID,
          thread: {
            messages: [
              {
                role: "user",
                content: chat || "Hi",
              },
            ],
          },
          stream: true,
        }),
        reactNative: { textStreaming: true },
      });

      setChat("");
      processStream(response);
    } catch (err) {
      console.error(err);
    }
  };

  const processStream = async (response) => {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    const readLoop = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        handleStreamedResponse(value);
      }
    };

    readLoop();

    const handleStreamedResponse = (value) => {
      const lines = decoder.decode(value).split("\n");
      for (const line of lines) {
        if (line.trim().startsWith("data:")) {
          const data = line.trim().slice(5);
          if (data.indexOf("DONE") > -1) {
            setIsLoading(false);
          } else {
            try {
              const event = JSON.parse(data);
              handleStreamedEvent(event);
            } catch (error) {
              // console.error("Error parsing streamed response:", error);
            }
          }
        }
      }
    };
  };

  const handleStreamedEvent = (event) => {
    switch (event.object) {
      case "thread":
        setThreadID(event.id);
        console.log(event.id);
      case "thread.message.delta":
        if (event.delta.content) {
          const content = event.delta.content[0].text.value;
          const formattedContent = content
            .replace(/\n/g, "<br/>")
            .replace(/\_\_(.+?)\_\_/g, "<strong>$1</strong>")
            .replace(/\_(.+?)\_/g, "<em>$1</em>")
            .replace(/\`(.+?)\`/g, "<code>$1</code>");

          setStreamedChunks((prevChunks) => [...prevChunks, formattedContent]);
          setIsLoading(false);
        }
        break;
      default:
        break;
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.inner}>
          <ScrollView style={{ marginTop: 25 }}>
            <Text style={{ flex: 1 }}>
              {completeResponse}
              {isLoading ? "Loading..." : streamedChunks}
            </Text>
          </ScrollView>
          <View style={{ flexDirection: "row", gap: 2 }}>
            <TextInput
              style={styles.input}
              onChangeText={setChat}
              value={chat}
              placeholder="Type your question here..."
            />
            <TouchableOpacity
              style={styles.button}
              onPress={threadID ? aiCreateRun : aiCreateThreadRun}>
              <Ionicons name="send" size={32} color="blue" />
            </TouchableOpacity>
            {/* {threadID && (
          <Button onPress={aiGetLastMessage} title="Get Last Message" />
        )} */}
          </View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    padding: 24,
    flex: 1,
    justifyContent: "space-around",
  },
  button: {
    alignItems: "center",
    padding: 10,
  },
  input: {
    padding: 5,
    borderWidth: 1,
    borderRadius: 10,
    flex: 1,
  },
});
