def binary_search(arr, target):
    left, right = 0, len(arr) - 1

    while left <= right:
        mid = (left + right) // 2

        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid
        else:
            right = mid - 1

    return -1  # Not found


if __name__ == "__main__":
    data = [1, 3, 5, 7, 9, 11]
    target = 7
    index = binary_search(data, target)
    print(f"Index of {target}: {index}")
