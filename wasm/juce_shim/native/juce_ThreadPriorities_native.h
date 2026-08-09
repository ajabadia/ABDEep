/*
  ==============================================================================

   This file is part of the JUCE library.
   Copyright (c) 2020 - Raw Material Software Limited

   JUCE is an open source library subject to commercial or open-source
   licenses.

   The code included in this file is provided under the terms of the ISC license
   http://www.isc.org/downloads/software-support-policy/isc-license.txt

   THE SAFE DESCENT OF THE SOFTWARE IS ENTIRELY AT YOUR OWN RISK.

  ==============================================================================
*/

namespace juce
{

struct ThreadPriorities
{
    struct Entry
    {
        Thread::Priority priority;
        int native;
    };

    static inline constexpr Entry table[]
    {
        { Thread::Priority::highest,    0 },
        { Thread::Priority::high,       0 },
        { Thread::Priority::normal,     0 },
        { Thread::Priority::low,        0 },
        { Thread::Priority::background, 0 }
    };

    static_assert (std::size (table) == 5,
                   "The platform may be unsupported or there may be a priority entry missing.");

    static inline Thread::Priority getPriority (int native) noexcept
    {
        const auto iter = std::min_element (std::begin (table),
                                            std::end   (table),
                                            [native] (const auto& a, const auto& b)
                                            {
                                                return std::abs (a.native - native) < std::abs (b.native - native);
                                            });

        return iter != std::end (table) ? iter->priority : Thread::Priority{};
    }

    static inline int getNative (Thread::Priority priority) noexcept
    {
        const auto iter = std::find_if (std::begin (table),
                                        std::end   (table),
                                        [priority] (const auto& entry) { return entry.priority == priority; });

        return iter != std::end (table) ? iter->native : 0;
    }
};

} // namespace juce
