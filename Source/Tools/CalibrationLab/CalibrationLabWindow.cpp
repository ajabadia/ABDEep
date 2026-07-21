#include "CalibrationLabWindow.h"
#include "CalibrationLabContentComponent.h"

CalibrationLabWindow::CalibrationLabWindow (juce::String name)
    : DocumentWindow (name,
                      juce::Desktop::getInstance().getDefaultLookAndFeel()
                                                  .findColour (juce::ResizableWindow::backgroundColourId),
                      DocumentWindow::allButtons)
{
    setUsingNativeTitleBar (true);
    setContentOwned (new CalibrationLabContentComponent(), true);

   #if JUCE_NUMPAD_KEYBOARD
    setComponentID ("MainWindow");
   #endif

    setResizable (true, true);
    centreWithSize (800, 600);
    setVisible (true);
}

CalibrationLabWindow::~CalibrationLabWindow()
{
}

void CalibrationLabWindow::closeButtonPressed()
{
    juce::JUCEApplication::getInstance()->systemRequestedQuit();
}
