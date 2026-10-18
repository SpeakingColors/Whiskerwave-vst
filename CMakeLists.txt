cmake_minimum_required(VERSION 3.22)
project(whiskerwave VERSION 0.0.1 LANGUAGES C CXX)

include(FetchContent)
FetchContent_Declare(juce GIT_REPOSITORY https://github.com/juce-framework/JUCE.git
    GIT_TAG 8.0.16-security GIT_SHALLOW TRUE)
FetchContent_MakeAvailable(juce)
FetchContent_Declare(cat_ui GIT_REPOSITORY https://github.com/SpeakingColors/cat-ui GIT_TAG main)
FetchContent_MakeAvailable(cat_ui)

juce_add_plugin(Whiskerwave
    COMPANY_NAME "SpeakingColors"
    PLUGIN_MANUFACTURER_CODE Spco
    PLUGIN_CODE Whwv
    FORMATS VST3 Standalone
    PRODUCT_NAME "Whiskerwave"
    IS_SYNTH TRUE NEEDS_MIDI_INPUT TRUE)

target_sources(Whiskerwave PRIVATE src/PluginProcessor.cpp src/PluginEditor.cpp)
target_compile_definitions(Whiskerwave PUBLIC JUCE_WEB_BROWSER=0 JUCE_USE_CURL=0 JUCE_VST3_CAN_REPLACE_VST2=0)
target_link_libraries(Whiskerwave PRIVATE cat_ui juce::juce_audio_utils juce::juce_dsp
    PUBLIC juce::juce_recommended_config_flags juce::juce_recommended_warning_flags)
