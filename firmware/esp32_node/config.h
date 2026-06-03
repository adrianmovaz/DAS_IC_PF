#ifndef CONFIG_H
#define CONFIG_H

#define WR_PIN 16
#define RD_PIN 17
#define INTR_PIN 34
static const int DB_PINS[8] = {13, 14, 27, 26, 25, 33, 32, 35};

#define SAMPLE_HZ 10

#define WIFI_SSID "TU_SSID"
#define WIFI_PASS "TU_PASSWORD"
#define SERVER_HOST "192.168.1.100"
#define SERVER_PORT 3000
#define SERVER_PATH "/ws"

#define VCC 5.0f
#define VFS 5.0f
#define R_FIXED 10000.0f
#define CAL_M -0.85f
#define CAL_B 5.50f

#endif
