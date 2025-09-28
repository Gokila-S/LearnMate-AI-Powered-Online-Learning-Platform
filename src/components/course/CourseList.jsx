import React, { useState, useEffect, useRef } from 'react';
import { useCourse } from '../../context/CourseContext';
import CourseCard from './CourseCard';
import LoadingSpinner from '../common/LoadingSpinner';

const CourseList = () => {
  const {
    courses,
    categories,
    loading,
    error,
    filters,
    totalPages,
    currentPage,
    fetchCourses,
    fetchCategories,
    searchCourses,
    updateFilters,
    clearError
  } = useCourse();

  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [liveResults, setLiveResults] = useState([]);
  const [usingLive, setUsingLive] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    fetchCategories();
    fetchCourses();
  }, []);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        clearError();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      setIsSearching(true);
      await searchCourses(searchTerm, filters);
      setIsSearching(false);
      setUsingLive(false); // manual search overrides live mode
    } else {
      await fetchCourses(filters);
      setUsingLive(false);
    }
  };

  const handleFilterChange = async (filterType, value) => {
    const newFilters = { ...filters, [filterType]: value };
    updateFilters(newFilters);
    
    if (searchTerm.trim()) {
      await searchCourses(searchTerm, newFilters);
    } else {
      await fetchCourses(newFilters);
    }
  };

  const handlePageChange = async (page) => {
    const newFilters = { ...filters, page };
    updateFilters(newFilters);
    
    if (searchTerm.trim()) {
      await searchCourses(searchTerm, newFilters);
    } else {
      await fetchCourses(newFilters);
    }
  };

  const clearSearch = async () => {
    setSearchTerm('');
    setLiveResults([]);
    setUsingLive(false);
    await fetchCourses(filters);
  };

  // Debounced live prefix search (startsWith)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!searchTerm) {
      setLiveResults([]);
      setUsingLive(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        setIsSearching(true);
        const params = new URLSearchParams();
        params.append('startsWith', searchTerm);
        if (filters.category && filters.category !== 'all') params.append('category', filters.category);
        if (filters.level && filters.level !== 'all') params.append('level', filters.level);
        params.append('limit', 50);
        const res = await fetch(`/api/courses?${params.toString()}`);
        const json = await res.json();
        if (json.success) {
          setLiveResults(json.data);
          setUsingLive(true);
        }
      } catch (err) {
        // ignore
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [searchTerm, filters.category, filters.level]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Explore Our Courses
        </h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          Discover a wide range of courses designed to help you learn new skills and advance your career.
        </p>
      </div>

      {/* Search and Filters */}
      <div className="mb-8">
        {/* Search Bar */}
        <form onSubmit={handleSearch} className="mb-6">
          <div className="relative max-w-2xl mx-auto">
            <input
              type="text"
              placeholder="Search courses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-3 pl-12 pr-24 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <svg
              className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex space-x-2">
              {searchTerm && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="px-3 py-1 text-sm text-gray-500 hover:text-gray-700"
                >
                  Clear
                </button>
              )}
              <button
                type="submit"
                disabled={isSearching}
                className="px-4 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {isSearching ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>
        </form>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 justify-center">
          {/* Category Filter */}
          <select
            value={filters.category}
            onChange={(e) => handleFilterChange('category', e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>

          {/* Level Filter */}
          <select
            value={filters.level}
            onChange={(e) => handleFilterChange('level', e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Levels</option>
            <option value="Beginner">Beginner</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Advanced">Advanced</option>
          </select>

          {/* Sort Filter */}
          <select
            value={filters.sort}
            onChange={(e) => handleFilterChange('sort', e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="createdAt">Newest First</option>
            <option value="title">Title A-Z</option>
            <option value="rating">Highest Rated</option>
            <option value="enrollments">Most Popular</option>
          </select>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && <LoadingSpinner size="lg" text="Loading courses..." />}

      {/* Course Grid */}
      {!loading && (usingLive ? liveResults : courses) && (usingLive ? liveResults : courses).length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
          {(usingLive ? liveResults : courses).map((course) => (
            <CourseCard key={course._id} course={course} />
          ))}
        </div>
      )}

      {/* No Results */}
  {!loading && (usingLive ? liveResults : courses) && (usingLive ? liveResults : courses).length === 0 && (
        <div className="text-center py-12">
          <svg
            className="mx-auto h-24 w-24 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">No courses found</h3>
          <p className="mt-2 text-gray-500">{searchTerm ? 'No courses match this prefix.' : 'Check back later for new courses.'}</p>
        </div>
      )}

      {/* Pagination */}
  {!loading && !usingLive && totalPages > 1 && (
        <div className="flex justify-center items-center space-x-2 mt-8">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          
          <div className="flex space-x-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const page = i + 1;
              return (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={`px-3 py-2 rounded-lg ${
                    currentPage === page
                      ? 'bg-blue-600 text-white'
                      : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {page}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default CourseList;
