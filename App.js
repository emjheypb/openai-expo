import { StatusBar } from "expo-status-bar";
import {
  StyleSheet,
  TextInput,
  SafeAreaView,
  Button,
  Text,
  ScrollView,
  View,
} from "react-native";
import React, { useState } from "react";

export default function App() {
  const [threadID, setThreadID] = useState("");
  const [chat, setChat] = useState("");
  const [reply, setReply] = useState([]);

  const [streamedChunks, setStreamedChunks] = useState([]);
  const [completeResponse, setCompleteResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const THREAD_URL = process.env.EXPO_PUBLIC_OPENAI_BASE_URL;
  const MESSAGE_URL = `${process.env.EXPO_PUBLIC_OPENAI_BASE_URL}/${threadID}/messages`;
  const RUN_URL = `${process.env.EXPO_PUBLIC_OPENAI_BASE_URL}/${threadID}/runs`;
  const THREAD_RUN_URL = `${process.env.EXPO_PUBLIC_OPENAI_BASE_URL}/runs`;

  const ASSISTANT_HEADER = {
    Authorization: `Bearer ${process.env.EXPO_PUBLIC_OPENAI_API_KEY}`,
    "Content-Type": "application/json",
    "OpenAI-Beta": "assistants=v2",
  };

  const aiCreateThread = async () => {
    try {
      const response = await fetch(THREAD_URL, {
        method: "POST",
        headers: ASSISTANT_HEADER,
      });
      const results = await response.json();
      setThreadID(results.id);
      setReply([]);
    } catch (err) {
      console.log(err);
    }
  };

  const aiGetMessage = async () => {
    try {
      const response = await fetch(MESSAGE_URL, {
        method: "GET",
        headers: ASSISTANT_HEADER,
      });
      const results = await response.json();
      setReply([results.data[0].content[0].text.value, ...reply]);
    } catch (err) {
      console.log(err);
    }
  };

  const aiCreateRun = async () => {
    setStreamedChunks([]);

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
      });

      setChat("");
      processStream(response);
    } catch (err) {
      console.log(err);
    }
  };

  const aiCreateThreadRun = async () => {
    setStreamedChunks([]);

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
      });

      setChat("");
      processStream(response);
    } catch (err) {
      console.log(err);
    }
  };

  const processStream = async (response) => {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

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
              console.error("Error parsing streamed response:", error);
            }
          }
        }
      }
    };

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
  };

  const handleStreamedEvent = (event) => {
    switch (event.object) {
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
      case "thread.message.completed":
        const finalMessage = event.content[0].text.value;
        const formattedFinalMessage = finalMessage
          .replace(/\n/g, "<br/>")
          .replace(/\_\_(.+?)\_\_/g, "<strong>$1</strong>")
          .replace(/\_(.+?)\_/g, "<em>$1</em>")
          .replace(/\`(.+?)\`/g, "<code>$1</code>");

        console.log("FORMATTED FINAL MESSAGE", formattedFinalMessage);
        setCompleteResponse(formattedFinalMessage);
        break;
      default:
        break;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <TextInput
        style={{ width: "100%", padding: 10 }}
        onChangeText={setChat}
        value={chat}
        placeholder="Type your question here..."
      />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Button onPress={aiCreateRun} title="Ask" />
        <Button onPress={aiCreateThreadRun} title="Ask On New Thread" />
      </View>
      <Button onPress={aiCreateThread} title="New Thread" />
      <Button onPress={aiGetMessage} title="Get Latest Message" />

      <ScrollView>
        <Text>Chunks: {streamedChunks}</Text>
        {reply.map((msg, index) => (
          <Text key={index} style={{ width: "100%", padding: 10 }}>
            {msg}
          </Text>
        ))}
      </ScrollView>

      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    margin: 10,
  },
});
