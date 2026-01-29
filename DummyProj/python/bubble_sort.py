def bubble_sort(arr):
    n = len(arr)

    for i in range(n - 1):
        for j in range(n - i - 1):
            if arr[j] > arr[j + 1]:
                # Swap
                arr[j], arr[j + 1] = arr[j + 1], arr[j]


if __name__ == "__main__":
    data = [5, 1, 4, 2, 8]
    bubble_sort(data)
    print("Sorted array:", " ".join(map(str, data)))
