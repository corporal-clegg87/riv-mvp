interface HelloWorldProps {
  message?: string
}

export default function HelloWorld({ message = "Hello World" }: HelloWorldProps) {
  return (
    <div className="text-center">
      <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
        {message}
      </h1>
      <p className="text-lg text-gray-600 dark:text-gray-300">
        Phase 1: Connectivity Test
      </p>
      <div className="mt-8 p-4 bg-green-100 dark:bg-green-900 rounded-lg">
        <p className="text-sm text-green-800 dark:text-green-200">
          ✅ Application is running successfully
        </p>
      </div>
    </div>
  )
}

