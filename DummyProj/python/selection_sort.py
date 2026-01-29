def selection_sort(arr):
    n = len(arr)

    for i in range(n - 1):
        min_idx = i

        for j in range(i + 1, n):
            if arr[j] < arr[min_idx]:
                min_idx = j

        arr[min_idx], arr[i] = arr[i], arr[min_idx]


if __name__ == "__main__":
    data = [64, 25, 12, 22, 11]
    selection_sort(data)
    print("Sorted array:", " ".join(map(str, data)))
