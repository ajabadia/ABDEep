#include <JuceHeader.h>

/*
    Dev server de Vite en Debug (recarga en vivo sin rebundlear).
    =====================================================================
    En Debug el editor puede cargar el servidor de desarrollo de Vite
    (http://localhost:5311, `npm run dev`) en vez del WebUI empaquetado: Vite
    sirve el arbol CRUDO resolviendo los bare imports @abdsynths/* al vuelo y
    con HMR, asi que un cambio en js/css/... aparece sin ejecutar
    `npm run bundle`.

    Contrato:

      - La URL la pone CMake (`ABDEEP_WEBUI_DEV_SERVER_URL` ->
        `ABDEEP_WEBUI_DEV_URL`) SOLO en Debug, y se puede sobrescribir o
        desactivar en runtime con la variable de entorno del mismo nombre
        (otro puerto, otra maquina, o 0/off/none).
      - Release ni siquiera compila este camino: el binario que se reparte
        sirve SIEMPRE el bundle embebido y jamas depende de un localhost.
      - Si el servidor no responde se devuelve cadena vacia y el editor cae al
        resource provider (WebUI/dist, o el arbol crudo en Debug); nunca se
        queda en blanco esperando a un servidor que no esta.

    Cargar http://... no rompe el puente nativo: JUCE inyecta el script de
    integracion con AddScriptToExecuteOnDocumentCreated, que aplica a TODOS los
    documentos del WebView2, sea cual sea el origen.
*/

namespace
{
    /** Espera maxima al servidor antes de darlo por ausente (ms). */
    constexpr int kProbeTimeoutMs = 200;

    /** Valores que desactivan el dev server aunque la define de CMake este puesta. */
    bool isDevServerDisabled (const juce::String& value)
    {
        return value == "0" || value.equalsIgnoreCase ("off")
            || value.equalsIgnoreCase ("none") || value.equalsIgnoreCase ("false");
    }

    /** true si hay algo sirviendo HTTP 200 en esa URL. */
    bool isDevServerReachable (const juce::URL& url)
    {
        // HEAD con timeout corto: en localhost un servidor ausente da
        // "connection refused" al instante, y el timeout solo cubre el caso
        // raro (host que no contesta). Esto corre en el constructor del editor,
        // asi que tiene que ser barato.
        const auto options = juce::URL::InputStreamOptions (juce::URL::ParameterHandling::inAddress)
                                 .withHttpRequestCmd ("HEAD")
                                 .withConnectionTimeoutMs (kProbeTimeoutMs)
                                 .withNumRedirectsToFollow (0);

        auto stream = url.createInputStream (options);

        if (stream == nullptr)
            return false;

        // createInputStream tambien devuelve stream con respuestas de error: el
        // 200 es lo que confirma que ahi hay un servidor de Vite (y no, por
        // ejemplo, otro servicio ocupando el puerto).
        if (auto* webStream = dynamic_cast<juce::WebInputStream*> (stream.get()))
            return webStream->getStatusCode() == 200;

        return true;
    }
}

/**
    URL del dev server de Vite, o cadena vacia si no hay que usarlo (Release,
    desactivado, o servidor ausente). Ver el contrato en la cabecera del fichero.
*/
juce::String getWebUiDevServerUrl()
{
   #if ! defined (ABDEEP_WEBUI_DEV_URL)
    // Release: siempre el bundle embebido (nada de localhost en un binario que
    // se reparte). CMake define ABDEEP_WEBUI_DEV_URL solo para Debug.
    return {};
   #else
    // Mismo nombre para la define y para la variable de entorno: la de entorno
    // manda (permite apuntar a otro puerto/maquina, o apagar el modo sin
    // recompilar). El literal no la expande el preprocesador.
    //
    // La define NO lleva comillas (CMake -> MSBuild -> cl se las come) y se
    // convierte en literal con JUCE_STRINGIFY: stringizar acepta cualquier
    // secuencia de tokens, cosa que no hace un par de comillas sueltas.
    auto configured = juce::SystemStats::getEnvironmentVariable ("ABDEEP_WEBUI_DEV_URL",
                                                                 JUCE_STRINGIFY (ABDEEP_WEBUI_DEV_URL)).trim();

    if (configured.isEmpty() || isDevServerDisabled (configured))
        return {};

    const juce::URL url (configured);

    if (! url.isWellFormed())
    {
        DBG ("[WebUI] ABDEEP_WEBUI_DEV_URL no es una URL valida: " + configured);
        return {};
    }

    if (! isDevServerReachable (url))
    {
        DBG ("[WebUI] dev server no responde (" + configured + "): se sirve el WebUI empaquetado");
        return {};
    }

    DBG ("[WebUI] dev server de Vite: " + configured + " (HMR, arbol crudo)");
    return url.toString (false);
   #endif
}
