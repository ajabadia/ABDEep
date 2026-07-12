/**
 * @purpose Headless test runner for FX Engine unit tests.
 * Initializes JUCE core manually (no GUI, no audio, no message loop needed)
 * and runs juce::UnitTestRunner::runAllTests().
 *
 * Usage:
 *   ./ABDEep_UnitTests              -> run all tests
 *   ./ABDEep_UnitTests --verbose    -> run all tests with detailed output
 *
 * @classification Test Runner
 * @complexity Low
 */

#include <JuceHeader.h>
#include <iostream>
#include <cstring>

//==============================================================================
int main (int argc, char* argv[])
{
    // Parse --verbose flag
    bool verbose = false;
    for (int i = 1; i < argc; ++i)
    {
        if (std::strcmp (argv[i], "--verbose") == 0 || std::strcmp (argv[i], "-v") == 0)
            verbose = true;
    }

    std::cout << "\n===========================================\n";
    std::cout << "  ABD Eep FX Unit Test Runner\n";
    std::cout << "===========================================\n\n";

    // Initialize minimal JUCE infrastructure needed for UnitTestRunner
    juce::MessageManager::getInstance();
    juce::initialiseJuce_GUI();

    // Create unit test runner
    juce::UnitTestRunner runner;
    runner.setAssertOnFailure (false);

    std::cout << "Running unit tests...\n\n";

    // Run all registered unit tests (FXUnitTests is auto-registered as static global)
    runner.runAllTests();

    // Print summary
    auto totalTests = runner.getNumResults();
    int passed = 0, failed = 0;
    for (int i = 0; i < totalTests; ++i)
    {
        if (auto* result = runner.getResult (i))
        {
            passed += result->passes;
            failed += result->failures;
        }
    }

    std::cout << "\n===========================================\n";
    std::cout << "  Test Summary\n";
    std::cout << "===========================================\n";
    std::cout << "  Total test suites: " << totalTests << "\n";
    std::cout << "  Passed: " << passed << "\n";
    std::cout << "  Failed: " << failed << "\n";
    std::cout << "===========================================\n\n";

    // Print verbose details if requested
    if (verbose && totalTests > 0)
    {
        for (int i = 0; i < totalTests; ++i)
        {
            if (auto* result = runner.getResult (i))
            {
                std::cout << "  Test results for suite " << (i + 1) << "\n";
                for (int m = 0; m < result->messages.size(); ++m)
                    std::cout << "    " << result->messages[m].toStdString() << "\n";
                std::cout << "    --- passes=" << result->passes
                          << " failures=" << result->failures << "\n\n";
            }
        }
    }

    juce::MessageManager::deleteInstance();

    return (failed > 0) ? 1 : 0;
}
