#include <Arduino.h>
#include "config.h"
#include "Reading.h"
#include "Adc0804.h"
#include "Linearization.h"
#include "Net.h"

Adc0804 adc;
hw_timer_t *timer = NULL;
volatile bool sampleFlag = false;
uint32_t seq = 0;

void IRAM_ATTR onTimer() {
  sampleFlag = true;
}

void setup() {
  Serial.begin(115200);
  adc.begin();
  netBegin();

  timer = timerBegin(1000000);
  timerAttachInterrupt(timer, &onTimer);
  timerAlarm(timer, 1000000 / SAMPLE_HZ, true, 0);
}

void loop() {
  netLoop();

  if (!sampleFlag) return;
  sampleFlag = false;

  uint8_t code = adc.read();

  Reading r;
  r.seq = seq++;
  r.tMs = millis();
  r.code = code;
  r.voltage = codeToVoltage(code);
  r.lux = codeToLux(code);

  netSend(r);
}
