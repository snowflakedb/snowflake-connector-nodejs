/*
 * Copyright (c) 2024 Snowflake Computing, Inc. All rights reserved.
 */

#pragma once
#ifndef BASECLASSES_HPP
#define BASECLASSES_HPP

#include <mutex>

namespace Snowflake
{
namespace Client
{
  /**
   * Inherit from this class to prohibit assignment and copy construction.
   * The inheritance should be private.
   *
   * Move construction is possible but protected, to allow subclasses
   * that cannot be copied, but can still be moved (such as std::unique_ptr).
   * Note that there is no move assignment operator. Technically, move
   * assignment is perfectly legal on DoNotCopy objects, but providing a public
   * or protected operator=(DoNotCopy&&) would make it too easy to
   * inadvertently slice a derived class when assigning from an rvalue.
   * Derived classes may still define their own move assignment operator,
   * skipping the assignment on the DoNotCopy base object.
   *
   * @example
   * class MyComplexClass : private DoNotCopy
   * {
   *   ...
   * };
   */
  class DoNotCopy
  {
  protected:

    // Allow default construction by subclass constructors
#if defined(WIN32) || defined(_WIN64)
	DoNotCopy() {}

    // Allow move construction by subclass constructors
	DoNotCopy(DoNotCopy &&other)
	{
	}

    // Protected destructor, to disable unsafe polymorphic destruction
	~DoNotCopy() {}
#else
    // Allow default construction by subclass constructors
    inline constexpr DoNotCopy() noexcept = default;

    // Allow move construction by subclass constructors
    inline DoNotCopy(DoNotCopy &&other) noexcept = default;

    // Protected destructor, to disable unsafe polymorphic destruction
    inline ~DoNotCopy() noexcept = default;
#endif

  private:
#if defined(WIN32) || defined(_WIN64)
    // Disallow copy construction and copy assignment
    DoNotCopy(const DoNotCopy&);
    DoNotCopy& operator=(const DoNotCopy&);
#else
    // Disallow copy construction and copy assignment
    DoNotCopy(const DoNotCopy&) = delete;
    DoNotCopy& operator=(const DoNotCopy&) = delete;
#endif

  };

  /**
   * The singleton template
   * This template provides getInstance() function
   * creating a singleton instance of the class T
   *
   * Usage:
   *   class T : public Singleton<T>
   *   { ... }
   */
  template <typename T>
  class Singleton
  {
  private:
  
  public:
    /**
     * Get the singleton instance
     */
    static T& getInstance()
    {
      if (!s_singleton)
      {
        std::lock_guard<std::mutex> guard(s_initLock);
        if (!s_singleton)
        {
          s_singleton = new T;
        }
      }
      return *s_singleton;
    }
  
  private:
    static std::mutex s_initLock;  // lock on the singleton intialization
    static T*    s_singleton;           // the singleton instance of the class T
  };
  
  // Static member declarations
  template <typename T> std::mutex Singleton<T>::s_initLock;
  template <typename T> T* Singleton<T>::s_singleton;

}  // namespace Client
}  // namespace Snowflake

#endif  /* BASECLASSES_HPP */

