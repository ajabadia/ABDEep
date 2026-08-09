/**
 * wasm_link_stubs.cpp — Mocks and Linker Stubs for JUCE WASM build.
 */

#include <JuceHeader.h>

namespace juce
{

// Minimal inline declaration of juce::Colour to satisfy compiler since juce_graphics is absent
class Colour
{
public:
    Colour (uint32 colorARGB) noexcept;
private:
    uint32 argb;
};

// Stub for juce::Colour constructor from uint32.
Colour::Colour (uint32 colorARGB) noexcept
{
    // Write the ARGB bytes directly to the start of the Colour class memory
    *(uint32*)(this) = colorARGB;
}

// Stub for juce::File::getSpecialLocation
File File::getSpecialLocation (const SpecialLocationType)
{
    return File();
}

// Stub for MessageManager::postMessageToSystemQueue
#if JUCE_MODULE_AVAILABLE_juce_events
bool MessageManager::postMessageToSystemQueue (MessageManager::MessageBase* message)
{
    delete message;
    return true;
}
#endif

} // namespace juce
