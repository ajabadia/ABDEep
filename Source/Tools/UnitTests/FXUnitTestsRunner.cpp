/**
 * @purpose Headless test runner for unit tests.
 * Initializes JUCE core manually (no GUI, no audio, no message loop needed)
 * and runs juce::UnitTestRunner::runAllTests().
 *
 * Usage:
 *   ./ABDEep_UnitTests              -> run all tests
 *   ./ABDEep_UnitTests --verbose    -> run all tests with detailed output
 *   ./ABDEep_UnitTests --name X     -> run only tests whose name contains X
 *   ./ABDEep_UnitTests --category X -> run only tests in the given category
 *   ./ABDEep_UnitTests --list       -> list all registered test suites
 *
 * @classification Test Runner
 * @complexity Low
 */

#include <JuceHeader.h>
#include <iostream>
#include <cstring>

#if defined(_MSC_VER)
#include <crtdbg.h>
#endif

//==============================================================================
class ConsoleRunner : public juce::UnitTestRunner
{
    void logMessage (const juce::String& message) override
    {
        juce::String copy (message);
        std::printf ("%s\n", copy.toRawUTF8());
    }
};

int main (int argc, char* argv[])
{
#if defined(_MSC_VER)
    // Enable CRT debug heap: validate heap on every allocation/deallocation
    _CrtSetDbgFlag(_CRTDBG_ALLOC_MEM_DF | _CRTDBG_CHECK_ALWAYS_DF | _CRTDBG_LEAK_CHECK_DF);
    _CrtSetReportMode(_CRT_ERROR, _CRTDBG_MODE_DEBUG | _CRTDBG_MODE_FILE);
    _CrtSetReportFile(_CRT_ERROR, _CRTDBG_FILE_STDERR);
#endif

    bool verbose = false;
    bool listOnly = false;
    juce::String filterName;
    juce::String filterCategory;

    for (int i = 1; i < argc; ++i)
    {
        if (std::strcmp (argv[i], "--verbose") == 0 || std::strcmp (argv[i], "-v") == 0)
            verbose = true;
        else if (std::strcmp (argv[i], "--list") == 0)
            listOnly = true;
        else if (std::strcmp (argv[i], "--name") == 0 && i + 1 < argc)
            filterName = argv[++i];
        else if (std::strcmp (argv[i], "--category") == 0 && i + 1 < argc)
            filterCategory = argv[++i];
    }

    auto allTests = juce::UnitTest::getAllTests();

    if (listOnly)
    {
        std::cout << "Registered test suites (" << allTests.size() << "):\n";
        for (auto* t : allTests)
            std::cout << "  - [" << t->getCategory().toStdString()
                      << "] " << t->getName().toStdString() << "\n";
        return 0;
    }

    std::cout << "\n===========================================\n";
    std::cout << "  ABD Eep Unit Test Runner\n";
    std::cout << "===========================================\n\n";

    ConsoleRunner runner;
    runner.setAssertOnFailure (false);

    if (filterName.isNotEmpty() || filterCategory.isNotEmpty())
    {
        juce::Array<juce::UnitTest*> testsToRun;

        if (filterName.isNotEmpty() && filterCategory.isNotEmpty())
        {
            auto byName = juce::UnitTest::getTestsWithName (filterName);
            auto byCat  = juce::UnitTest::getTestsInCategory (filterCategory);
            for (auto* t : byName)
                if (byCat.contains (t))
                    testsToRun.add (t);
        }
        else if (filterName.isNotEmpty())
        {
            testsToRun = juce::UnitTest::getTestsWithName (filterName);
        }
        else
        {
            testsToRun = juce::UnitTest::getTestsInCategory (filterCategory);
        }

        std::cout << "  Running " << testsToRun.size() << " matching test suite(s)...\n\n";
        std::cout.flush();
        runner.runTests (testsToRun);
    }
    else
    {
        runner.runAllTests();
    }

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
    std::cout << "  Total assertions passed: " << passed << "\n";
    std::cout << "  Total assertions failed: " << failed << "\n";
    std::cout << "===========================================\n\n";

    if (verbose && totalTests > 0)
    {
        for (int i = 0; i < totalTests; ++i)
        {
            if (auto* result = runner.getResult (i))
            {
                std::cout << "  [" << result->unitTestName.toStdString() << "] "
                          << result->subcategoryName.toStdString() << "\n";
                for (int m = 0; m < result->messages.size(); ++m)
                    std::cout << "    " << result->messages[m].toStdString() << "\n";
                std::cout << "    passes=" << result->passes
                          << " failures=" << result->failures << "\n\n";
            }
        }
    }

    return (failed > 0) ? 1 : 0;
}
