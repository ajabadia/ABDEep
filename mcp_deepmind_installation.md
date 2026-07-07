# Guía de Instalación - Servidor MCP DeepMind 12

Tienes Node.js (v24.16) y npx (v11.7) instalados en tu sistema, por lo que cumples perfectamente con todos los requisitos técnicos para ejecutar el servidor MCP.

Sigue estos sencillos pasos para dejarlo listo en tu entorno:

---

## Paso 1: Conectar el hardware
1. Conecta tu **Behringer DeepMind 12** a tu computadora usando un cable USB.
2. Asegúrate de que el sintetizador esté encendido.

---

## Paso 2: Configurar tu cliente de IA (Claude Desktop o VS Code)

### Para Claude Desktop
1. Presiona `Win + R` en tu teclado, escribe `%APPDATA%\Claude` y presiona Enter.
2. Abre el archivo `claude_desktop_config.json` con un editor de texto (como Notepad o VS Code).
3. Añade la configuración del servidor en el objeto `mcpServers`. Debería verse similar a esto:

```json
{
  "mcpServers": {
    "deepmind12": {
      "command": "npx",
      "args": [
        "-y",
        "patchwork-deepmind"
      ]
    }
  }
}
```

4. Guarda el archivo y reinicia **Claude Desktop**.

---

### Para VS Code (si usas la extensión Cline, Roo Code o similar con MCP)
1. Presiona `Win + R`, escribe `%APPDATA%\Code\User` y presiona Enter.
2. Abre o crea el archivo `mcp.json`.
3. Añade la misma configuración del servidor anterior:

```json
{
  "mcpServers": {
    "deepmind12": {
      "command": "npx",
      "args": [
        "-y",
        "patchwork-deepmind"
      ]
    }
  }
}
```

4. Guarda el archivo y reinicia **VS Code**.

---

## Paso 3: Probar el funcionamiento
Una vez reiniciado tu cliente de IA (Claude Desktop o VS Code), el modelo de lenguaje detectará automáticamente las herramientas del DeepMind. Puedes probarlo pidiéndole:

> *"Lista las herramientas disponibles de deepmind12"*
> *"Lee el preset actual de mi sintetizador"* (esto disparará `snapshot_state` en tu hardware)
