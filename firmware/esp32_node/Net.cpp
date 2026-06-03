#include "Net.h"
#include "config.h"
#include <WiFi.h>
#include <WebSocketsClient.h>

static WebSocketsClient ws;

void netBegin() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) {
    delay(300);
  }
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());

  ws.begin(SERVER_HOST, SERVER_PORT, SERVER_PATH);
  ws.setReconnectInterval(2000);
}

void netLoop() {
  ws.loop();
}

void netSend(const Reading &r) {
  char buf[160];
  snprintf(buf, sizeof(buf),
           "{\"seq\":%u,\"tMs\":%u,\"code\":%u,\"voltage\":%.4f,\"lux\":%.2f}",
           r.seq, r.tMs, r.code, r.voltage, r.lux);
  ws.sendTXT(buf);
}
